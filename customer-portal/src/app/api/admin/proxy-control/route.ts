import { NextRequest, NextResponse } from 'next/server';
import { adminForbidden, verifyAdminAccess } from '@/lib/admin';
import { fetchProxyControlSnapshot } from '@/lib/proxy-control-bridge';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/proxy-control
 *
 * Returns the normalized Proxy Control Center snapshot (tier rows + settings)
 * backed by the OmniRoute proxy-control service. See
 * `src/lib/proxy-control-bridge.ts` for why this bridges to OmniRoute rather
 * than importing the reusable proxy package directly.
 *
 * Response always has a stable shape (`ProxyControlSnapshot`) so the UI can
 * render an honest empty state when the OmniRoute side is absent (`source:
 * 'unavailable'`) instead of falling back to client-side mock rows.
 */
export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  const snapshot = await fetchProxyControlSnapshot();
  return NextResponse.json(snapshot);
}

/**
 * POST on this route is intentionally not implemented. The canonical actions
 * endpoint is `POST /api/admin/proxy-control/actions` and settings writes go
 * to `PATCH /api/admin/proxy-control/settings`. Files are colocated so
 * calling clients have one obvious entry point per verb.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Use POST /api/admin/proxy-control/actions or PATCH /api/admin/proxy-control/settings' },
    { status: 404 },
  );
}
