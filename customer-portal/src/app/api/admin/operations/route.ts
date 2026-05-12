import { NextRequest, NextResponse } from 'next/server';
import { adminForbidden, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const OMNIROUTE_URL = process.env.OMNIROUTE_INTERNAL_URL || 'http://omniroute:20128';

async function fetchJson(path: string) {
  const res = await fetch(`${OMNIROUTE_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  if (!verifyAdminAccess(req)) {
    return adminForbidden();
  }

  try {
    const [health, providerMetrics] = await Promise.all([
      fetchJson('/api/monitoring/health'),
      fetchJson('/api/provider-metrics'),
    ]);
    const degradation = await fetchJson('/api/health/degradation?summary=true');

    return NextResponse.json({
      health,
      providerMetrics: providerMetrics.metrics || {},
      degradation,
    });
  } catch (error) {
    console.error('Admin operations fetch error:', error);
    return NextResponse.json({ error: 'Failed to load operations data' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminAccess(req)) {
    return adminForbidden();
  }

  try {
    const res = await fetch(`${OMNIROUTE_URL}/api/monitoring/health`, {
      method: 'DELETE',
      cache: 'no-store',
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: payload?.error || 'Failed to reset breakers' }, { status: res.status });
    }

    return NextResponse.json({ success: true, payload });
  } catch (error) {
    console.error('Admin operations reset error:', error);
    return NextResponse.json({ error: 'Failed to reset breakers' }, { status: 500 });
  }
}
