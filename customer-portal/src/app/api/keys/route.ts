import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  createOmniRouteKey,
  deleteOmniRouteKey,
  planKeyLimits,
  updateKeyLimits,
  listOmniRouteKeys,
} from '@/lib/omniroute';
import prisma from '@/lib/db';
import { recordAdminAction } from '@/lib/admin';
import { isWithinGracePeriod } from '@/lib/reconcile';

export const dynamic = 'force-dynamic';

// GET /api/keys — list user's API keys, reconciled against OmniRoute
//
// The portal (PostgreSQL) and OmniRoute (SQLite) are two separate databases
// that can drift. This endpoint now reconciles the user's mappings on every
// read so the dashboard never shows a key that OmniRoute has already deleted
// (which would be the "api keys not working" symptom users reported).
export async function GET() {
  try {
    const user = await requireAuth();

    // Pull the user's mappings AND the full OmniRoute key list in parallel.
    // listOmniRouteKeys returns masked keys (no raw key) — we only need the
    // ids to detect drift.
    const [portalKeys, omniKeys] = await Promise.all([
      prisma.userApiKey.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      listOmniRouteKeys().catch((err) => {
        // If OmniRoute is unreachable we still return the portal's view —
        // better to show stale mappings than a 500 that blocks the whole
        // dashboard. The reconciliation just won't run this time.
        console.error('Reconcile: could not list OmniRoute keys:', err);
        return null;
      }),
    ]);

    // Reconcile: find portal mappings whose omniroute_key_id no longer exists
    // in OmniRoute. Those keys are dead — the user can't use them. Mark them
    // isActive=false in the portal so the UI shows "Revoked" and the user is
    // prompted to create a new one, instead of handing them a key that 401s.
    //
    // Mappings inside the grace window are skipped: a snapshot racing key
    // creation can miss a brand-new key, and wrongly marking its mapping
    // inactive gets the real credential deleted by the admin reconciler's
    // revoked-key sweep. See lib/reconcile.ts.
    if (omniKeys) {
      const omniKeyIds = new Set(omniKeys.map((k) => k.id));
      const stale = portalKeys.filter(
        (k) =>
          k.isActive &&
          !omniKeyIds.has(k.omnirouteKeyId) &&
          !isWithinGracePeriod(k.createdAt)
      );
      if (stale.length > 0) {
        await prisma.userApiKey.updateMany({
          where: { id: { in: stale.map((k) => k.id) } },
          data: { isActive: false },
        });
        for (const k of stale) {
          await recordAdminAction({
            action: 'user.key_reconciled_orphan',
            actor: 'system',
            targetUserId: user.id,
            targetUserEmail: user.email,
            metadata: {
              keyId: k.id,
              omnirouteKeyId: k.omnirouteKeyId,
              name: k.name,
              reason: 'omniroute_key_missing',
            },
          });
        }
        // Reflect the update in the returned list
        for (const k of portalKeys) {
          if (stale.some((s) => s.id === k.id)) {
            k.isActive = false;
          }
        }
      }
    }

    return NextResponse.json({ keys: portalKeys });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/keys — create new API key (atomic across both databases)
//
// Atomicity contract:
//   1. Create the key in OmniRoute first (it's the source of truth for the
//      actual credential).
//   2. Write the mapping in the portal.
//   3. If step 2 fails, DELETE the OmniRoute key so we don't leak an
//      orphaned, usable key that no portal user owns.
//   4. If step 3 also fails, log loudly — that key is now an orphan in
//      OmniRoute and must be cleaned up by the reconciliation script.
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Validate before any side effects: a non-string `name` would pass
    // `name || 'Default Key'`, create the OmniRoute key, then fail the portal
    // mapping write — a pointless create/rollback round-trip on the
    // credential store for every malformed request.
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { name } = body as Record<string, unknown>;
    if (name !== undefined && typeof name !== 'string') {
      return NextResponse.json({ error: 'Key name must be a string' }, { status: 400 });
    }
    if (typeof name === 'string' && name.length > 100) {
      return NextResponse.json(
        { error: 'Key name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Enforce key limit based on plan
    const keyCount = await prisma.userApiKey.count({
      where: { userId: user.id, isActive: true },
    });
    const maxKeys =
      user.planId === 'free' ? 2 : user.planId === 'pro' ? 5 : user.planId === 'max-5x' ? 10 : 20;
    if (keyCount >= maxKeys) {
      return NextResponse.json(
        { error: `Maximum ${maxKeys} API keys allowed on your plan` },
        { status: 403 }
      );
    }

    // Determine if user has shadowban/shadowlock active
    const scopes: string[] = [];
    if (user.isShadowLocked) {
      scopes.push('shadow_lock');
    }
    if (user.isShadowBanned) {
      scopes.push('shadow_ban');
    }

    // Step 1 — create the key in OmniRoute (source of truth for the credential)
    const keyName = `${user.email} - ${name || 'Default Key'}`;
    let omniKey;
    try {
      omniKey = await createOmniRouteKey(keyName, scopes);
    } catch (err) {
      console.error('Key creation: OmniRoute create failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to create API key: ${message}` },
        { status: 502 }
      );
    }

    // Step 2 — write the mapping in the portal. If this fails we MUST roll
    // back the OmniRoute key (step 3) so we don't leak an unowned credential.
    let userKey;
    try {
      userKey = await prisma.userApiKey.create({
        data: {
          userId: user.id,
          omnirouteKeyId: omniKey.id,
          name: name || 'Default Key',
          lastFour: omniKey.key.slice(-4),
        },
      });
    } catch (err) {
      console.error('Key creation: portal mapping write failed — rolling back OmniRoute key:', err);
      try {
        await deleteOmniRouteKey(omniKey.id);
      } catch (rollbackErr) {
        // This is the worst case: the key exists in OmniRoute but no portal
        // user owns it. Log loudly so an operator can delete it manually,
        // and the reconciliation script will catch it on the next run.
        console.error(
          'KEY ORPHAN ALERT: OmniRoute key %s could not be rolled back and has no portal owner:',
          omniKey.id,
          rollbackErr
        );
      }
      return NextResponse.json(
        { error: 'Failed to save API key mapping' },
        { status: 500 }
      );
    }

    // Step 4 — apply plan limits. A failure here is non-fatal: the key works,
    // it just isn't rate-capped by the plan. Log it so it's visible.
    try {
      const userWithPlan = await prisma.user.findUnique({
        where: { id: user.id },
        include: { plan: true },
      });

      if (userWithPlan?.plan) {
        await updateKeyLimits(omniKey.id, planKeyLimits(userWithPlan.plan));
      }
    } catch (err) {
      // Non-fatal — key is created and usable, just uncapped.
      console.error('Key creation: failed to apply plan limits (non-fatal):', err);
    }

    await recordAdminAction({
      action: 'user.key_created',
      actor: user.email,
      targetUserId: user.id,
      targetUserEmail: user.email,
      metadata: { keyId: userKey.id, keyName: userKey.name, omnirouteKeyId: omniKey.id },
    });

    return NextResponse.json({
      key: userKey,
      rawKey: omniKey.key, // Only returned once!
      message: 'Save this key — it will not be shown again.',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Key creation error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

// DELETE /api/keys — revoke an API key (idempotent across both databases)
//
// Deletion order matters:
//   1. Delete the mapping in the portal FIRST. If OmniRoute is down, the user
//      can no longer see/use the key from the portal, and the reconciliation
//      path will retry the OmniRoute delete later.
//   2. Then delete in OmniRoute. A 404 is fine (already gone). Other errors
//      leave an orphan in OmniRoute that the reconciliation script cleans up.
//
// The previous implementation deleted in OmniRoute first and removed the
// portal mapping second — if the OmniRoute delete threw, the portal mapping
// stayed and the user saw a "working" key that 401'd on every request.
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await req.json().catch(() => null);
    const keyId = body && typeof body === 'object' ? (body as Record<string, unknown>).keyId : undefined;
    if (typeof keyId !== 'string' || keyId.length === 0) {
      return NextResponse.json({ error: 'Key ID required' }, { status: 400 });
    }

    const key = await prisma.userApiKey.findFirst({
      where: { id: keyId, userId: user.id },
    });

    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    const omnirouteKeyId = key.omnirouteKeyId;

    // 1. Remove the portal mapping first so the key disappears from the
    //    user's dashboard immediately, even if OmniRoute is unreachable.
    await prisma.userApiKey.delete({ where: { id: keyId } });

    // 2. Best-effort delete in OmniRoute. 404 = already gone (idempotent).
    //    Other errors are logged but don't fail the request — the mapping is
    //    already gone, so the user can't use the key from the portal, and the
    //    orphaned OmniRoute key will be reaped by the reconciliation script.
    try {
      await deleteOmniRouteKey(omnirouteKeyId);
    } catch (err) {
      console.error(
        'Key revoke: OmniRoute delete failed for %s (orphan will be reconciled):',
        omnirouteKeyId,
        err
      );
    }

    await recordAdminAction({
      action: 'user.key_revoked',
      actor: user.email,
      targetUserId: user.id,
      targetUserEmail: user.email,
      metadata: { keyId, omnirouteKeyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Key revoke error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
