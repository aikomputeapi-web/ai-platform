import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';
import { postProxyControlAction } from '@/lib/proxy-control-bridge';
import type { ProxyManualAction } from '@/lib/proxy-control';

export const dynamic = 'force-dynamic';

const ALLOWED_ACTIONS: ReadonlySet<ProxyManualAction> = new Set<ProxyManualAction>([
  'promote',
  'demote',
  'quarantine',
  'remove',
  'run-check',
  'run-sync',
]);

/**
 * POST /api/admin/proxy-control/actions
 *
 * Executes a manual/bulk action against the proxy pool via the OmniRoute
 * proxy-control service. Body is `{ action, selectionKeys[], actor? }` where
 * `selectionKeys` are the normalized `tier:sourceId` keys produced by the
 * snapshot endpoint. Supported actions:
 *
 *  - promote       → elevate selected Tier 2 candidates into the global pool
 *  - demote        → drop selected Tier 3 entries back to Tier 2 review
 *  - quarantine    → clear counters / suspend a row (best-effort via OmniRoute)
 *  - remove        → delete selected free-pool rows
 *  - run-check     → trigger a check tick on the owning free-proxy service
 *  - run-sync      → trigger a sync tick on the owning free-proxy service
 *
 * `run-check` and `run-sync` accept an empty `selectionKeys` array to denote a
 * global tick; per-row enforcement of those is left to OmniRoute.
 */
export async function POST(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  let body: { action?: string; selectionKeys?: unknown; actor?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';
  if (!ALLOWED_ACTIONS.has(action as ProxyManualAction)) {
    return NextResponse.json(
      { error: `Unsupported action: ${action || '<missing>'}` },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.selectionKeys)) {
    return NextResponse.json({ error: 'selectionKeys[] is required' }, { status: 400 });
  }

  const selectionKeys = body.selectionKeys
    .filter((k): k is string => typeof k === 'string' && k.includes(':'))
    .map((k) => k.trim())
    .filter(Boolean);

  // run-check / run-sync may legitimately operate across all rows, so permit
  // an empty selection for those.
  const tickAction = action === 'run-check' || action === 'run-sync';
  if (!tickAction && selectionKeys.length === 0) {
    return NextResponse.json({ error: 'selectionKeys[] cannot be empty' }, { status: 400 });
  }

  const actor = typeof body.actor === 'string' && body.actor.trim() ? body.actor.trim() : 'admin';

  const result = await postProxyControlAction({
    action,
    selectionKeys,
    actor,
  });

  if (!result.ok) {
    const status = result.error.status === 0 ? 502 : Math.min(599, result.error.status);
    return NextResponse.json(
      {
        error: result.error.message,
        upstreamStatus: result.error.status,
        applied: result.partial?.applied ?? 0,
        skipped: result.partial?.skipped ?? selectionKeys.length,
      },
      { status },
    );
  }

  await recordAdminAction({
    action: `proxy-control.action.${action}`,
    req,
    metadata: {
      actor,
      action,
      selectionKeyCount: selectionKeys.length,
      applied: result.result.applied,
      skipped: result.result.skipped,
      errors: result.result.errors.length,
    } as Prisma.InputJsonValue,
  });

  return NextResponse.json(result.result);
}
