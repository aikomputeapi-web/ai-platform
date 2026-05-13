import { NextRequest, NextResponse } from 'next/server';
import { adminForbidden, verifyAdminAccess } from '@/lib/admin';
import { omnirouteFetch } from '@/lib/omniroute';

export const dynamic = 'force-dynamic';

async function fetchJson(path: string) {
  const res = await omnirouteFetch(path, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const [healthResult, providerMetricsResult, degradationResult] = await Promise.allSettled([
      fetchJson('/api/monitoring/health'),
      fetchJson('/api/provider-metrics'),
      fetchJson('/api/health/degradation?summary=true'),
    ]);

    const health = healthResult.status === 'fulfilled' ? healthResult.value : null;
    const providerMetrics = providerMetricsResult.status === 'fulfilled' ? providerMetricsResult.value : { metrics: {} };
    const degradation = degradationResult.status === 'fulfilled' ? degradationResult.value : { features: [], summary: null };

    if (healthResult.status === 'rejected') {
      console.error('Admin operations health fetch error:', healthResult.reason);
    }
    if (providerMetricsResult.status === 'rejected') {
      console.warn('Admin operations provider metrics fetch failed:', providerMetricsResult.reason);
    }
    if (degradationResult.status === 'rejected') {
      console.warn('Admin operations degradation fetch failed:', degradationResult.reason);
    }

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
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const res = await omnirouteFetch('/api/monitoring/health', {
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
