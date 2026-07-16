import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';
import { listOmniRouteKeys, deleteOmniRouteKey } from '@/lib/omniroute';

export const dynamic = 'force-dynamic';

// Key creation is a two-step write (OmniRoute key first, portal mapping
// second — see app/api/keys/route.ts), and this route snapshots the two
// stores concurrently. A snapshot taken between the two steps sees the new
// OmniRoute key as "orphaned" and would delete a credential the user was
// just issued; the mirror-image race (mapping visible, key not in the omni
// snapshot yet) would mark a brand-new mapping inactive. Anything younger
// than this window is skipped and re-checked on the next cycle instead.
const RECONCILE_GRACE_MS = 10 * 60 * 1000;

function isWithinGracePeriod(createdAt: string | Date | undefined): boolean {
  if (!createdAt) return false; // unknown age — reconcile as before
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && t > Date.now() - RECONCILE_GRACE_MS;
}

/**
 * POST /api/admin/keys/reconcile
 *
 * Two-way reconciliation between the Customer Portal (PostgreSQL) and
 * OmniRoute (SQLite) API key stores. OmniRoute is the single source of truth
 * that *issues* keys; the portal *mirrors* them. This endpoint keeps the
 * mirror in sync so the two can't drift:
 *
 *   1. Portal mappings whose OmniRoute key is missing → mark isActive=false
 *      (the user sees "Revoked" instead of a key that 401s on every request).
 *   2. OmniRoute keys with no portal mapping → delete from OmniRoute
 *      (unowned credentials are a security hole and inflate the count).
 *
 * Auth: admin session OR Bearer ADMIN_API_SECRET (the scheduled worker uses
 * the Bearer form). A `?prune=false` query param runs step 1 only (safe,
 * non-destructive) — useful for a read-only health check.
 *
 * Returns a JSON report of what was found and what was changed.
 */
export async function POST(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  const prune = (req.nextUrl.searchParams.get('prune') ?? 'true') !== 'false';

  try {
    // Pull both stores. listOmniRouteKeys returns masked keys (no raw key) —
    // we only need ids + isActive for reconciliation.
    const [portalKeys, omniKeys] = await Promise.all([
      prisma.userApiKey.findMany({
        include: { user: { select: { email: true } } },
      }),
      listOmniRouteKeys().catch((err) => {
        // If OmniRoute is unreachable, we can still reconcile the portal
        // side against the last-known OmniRoute state — but we have no
        // OmniRoute state, so we can only report. Don't 500 the whole call.
        console.error('reconcile: could not list OmniRoute keys:', err);
        return null;
      }),
    ]);

    const report = {
      prune,
      omniRouteReachable: omniKeys !== null,
      portalMappings: portalKeys.length,
      omniRouteKeys: omniKeys?.length ?? null,
      deadPortalMappings: 0,
      deadPortalMappingsMarkedInactive: 0,
      orphanedOmniRouteKeys: 0,
      orphanedOmniRouteKeysDeleted: 0,
      orphanedOmniRouteKeyDeleteFailures: 0,
      skippedRecentPortalMappings: 0,
      skippedRecentOmniRouteKeys: 0,
      details: {
        deadMappings: [] as Array<{ keyId: string; name: string; omnirouteKeyId: string; email: string | null }>,
        orphanedKeys: [] as Array<{ id: string; name: string; deleted: boolean; error?: string }>,
      },
    };

    if (!omniKeys) {
      // OmniRoute unreachable — return the report with no changes applied.
      return NextResponse.json(report);
    }

    const omniKeyIds = new Set(omniKeys.map((k) => k.id));

    // 1. Portal mappings pointing at a missing OmniRoute key → mark inactive.
    const missingKeyMappings = portalKeys.filter(
      (k) => k.isActive && !omniKeyIds.has(k.omnirouteKeyId)
    );
    const deadMappings = missingKeyMappings.filter((k) => !isWithinGracePeriod(k.createdAt));
    report.skippedRecentPortalMappings = missingKeyMappings.length - deadMappings.length;
    report.deadPortalMappings = deadMappings.length;
    if (deadMappings.length > 0 && prune) {
      const result = await prisma.userApiKey.updateMany({
        where: { id: { in: deadMappings.map((k) => k.id) } },
        data: { isActive: false },
      });
      report.deadPortalMappingsMarkedInactive = result.count;
      for (const k of deadMappings) {
        report.details.deadMappings.push({
          keyId: k.id,
          name: k.name,
          omnirouteKeyId: k.omnirouteKeyId,
          email: k.user?.email ?? null,
        });
      }
      await recordAdminAction({
        action: 'admin.keys.reconcile.dead_mappings',
        actor: req.headers.get('x-worker') === 'scheduled-reconciler' ? 'system' : 'admin',
        metadata: { count: deadMappings.length, prune },
      });
    }

    // 2. OmniRoute keys with no portal mapping → delete (unowned credentials).
    const portalKeyIds = new Set(portalKeys.map((k) => k.omnirouteKeyId));
    const unmappedOmniKeys = omniKeys.filter((k) => !portalKeyIds.has(k.id));
    const orphanedOmniKeys = unmappedOmniKeys.filter((k) => !isWithinGracePeriod(k.createdAt));
    report.skippedRecentOmniRouteKeys = unmappedOmniKeys.length - orphanedOmniKeys.length;
    report.orphanedOmniRouteKeys = orphanedOmniKeys.length;
    if (orphanedOmniKeys.length > 0 && prune) {
      for (const k of orphanedOmniKeys) {
        try {
          await deleteOmniRouteKey(k.id);
          report.orphanedOmniRouteKeysDeleted++;
          report.details.orphanedKeys.push({ id: k.id, name: k.name, deleted: true });
        } catch (err) {
          report.orphanedOmniRouteKeyDeleteFailures++;
          report.details.orphanedKeys.push({
            id: k.id,
            name: k.name,
            deleted: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      await recordAdminAction({
        action: 'admin.keys.reconcile.orphaned_keys',
        actor: req.headers.get('x-worker') === 'scheduled-reconciler' ? 'system' : 'admin',
        metadata: {
          count: orphanedOmniKeys.length,
          deleted: report.orphanedOmniRouteKeysDeleted,
          failed: report.orphanedOmniRouteKeyDeleteFailures,
          prune,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Reconcile keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/keys/reconcile — dry-run report (prune=false).
 * Convenience for a read-only health check from the dashboard or monitoring.
 */
export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }
  // Reuse POST with prune=false by calling the same logic. We pass the flag
  // via the query string so the worker can also GET for a dry-run.
  const url = new URL(req.url);
  url.searchParams.set('prune', 'false');
  const postReq = new NextRequest(url, { method: 'POST', headers: req.headers });
  return POST(postReq);
}
