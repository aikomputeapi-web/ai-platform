/**
 * /api/aa — Artificial Analysis API Proxy
 * ─────────────────────────────────────────────────────────────────────────────
 * Proxies requests to the Artificial Analysis API server-side, ensuring the
 * API key never reaches the client bundle.
 *
 * Usage:
 *   GET /api/aa?endpoint=leaderboard   → intelligence leaderboard
 *   GET /api/aa?endpoint=metrics       → all model metrics
 *   GET /api/aa?endpoint=speed         → speed ranking
 *   GET /api/aa?endpoint=price         → price ranking
 *   GET /api/aa?endpoint=scatter       → intelligence vs price scatter
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getLeaderboard,
  getModelMetrics,
  getSpeedRanking,
  getPriceRanking,
  getIntelligenceVsPrice,
} from '@/lib/artificialanalysis';

// Cache responses for 1 hour at the CDN/edge layer
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint') ?? 'metrics';

  try {
    let data: unknown;

    switch (endpoint) {
      case 'leaderboard':
        data = await getLeaderboard();
        break;
      case 'speed':
        data = await getSpeedRanking();
        break;
      case 'price':
        data = await getPriceRanking();
        break;
      case 'scatter':
        data = await getIntelligenceVsPrice();
        break;
      case 'metrics':
      default:
        data = await getModelMetrics();
        break;
    }

    return NextResponse.json(
      { data, updatedAt: new Date().toISOString(), source: 'artificialanalysis.ai' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('[/api/aa] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch model data', updatedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
