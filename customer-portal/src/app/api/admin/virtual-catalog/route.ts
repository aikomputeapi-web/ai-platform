import { NextRequest, NextResponse } from 'next/server';
import { adminForbidden, verifyAdminAccess } from '@/lib/admin';
import { omnirouteFetch } from '@/lib/omniroute';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/virtual-catalog
 * Proxy to OmniRoute's virtual catalog API — returns current catalog state.
 */
export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const res = await omnirouteFetch('/api/virtual-catalog', { cache: 'no-store' });
    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error: error || 'Failed to fetch catalog' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error) {
    console.error('Virtual catalog fetch error:', error);
    return NextResponse.json({ error: 'Failed to load virtual catalog' }, { status: 500 });
  }
}

/**
 * POST /api/admin/virtual-catalog
 * Proxy to OmniRoute — generate or toggle virtual catalog.
 */
export async function POST(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const body = await req.json();
    const res = await omnirouteFetch('/api/virtual-catalog', {
      method: 'POST',
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: payload?.error || 'Failed to update catalog' }, { status: res.status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Virtual catalog update error:', error);
    return NextResponse.json({ error: 'Failed to update virtual catalog' }, { status: 500 });
  }
}
