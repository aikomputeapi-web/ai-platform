import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getUsageAnalytics } from '@/lib/omniroute';

export const dynamic = 'force-dynamic';

function verifyAdminAccess(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_API_SECRET || process.env.OMNIROUTE_INITIAL_PASSWORD || 'admin';
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;
  return authHeader.replace('Bearer ', '') === adminSecret;
}

/**
 * Forecast API — returns historical daily data plus projected values.
 * Uses linear regression + exponential smoothing on daily trends to
 * predict next 30/60/90 days of requests, tokens, cost, and user growth.
 */
export async function GET(req: NextRequest) {
  if (!verifyAdminAccess(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fetch 90 days of analytics for the longest possible baseline
    const analytics = await getUsageAnalytics('90d');
    const dailyTrend: { date: string; requests: number; tokens: number; cost: number }[] = analytics?.dailyTrend || [];

    // Get user growth data from the database
    const users = await prisma.user.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Build daily user signup counts
    const signupsByDay: Record<string, number> = {};
    for (const u of users) {
      const day = u.createdAt.toISOString().split('T')[0];
      signupsByDay[day] = (signupsByDay[day] || 0) + 1;
    }

    // Build cumulative user count per day
    const allDays = [...new Set([
      ...Object.keys(signupsByDay),
      ...dailyTrend.map(d => d.date),
    ])].sort();

    let cumUsers = 0;
    const historicalDays = allDays.map(day => {
      cumUsers += (signupsByDay[day] || 0);
      const trend = dailyTrend.find(t => t.date === day);
      return {
        date: day,
        requests: trend?.requests || 0,
        tokens: trend?.tokens || 0,
        cost: trend?.cost || 0,
        newUsers: signupsByDay[day] || 0,
        totalUsers: cumUsers,
      };
    });

    // ── Forecasting Algorithms ──

    // Simple Linear Regression
    function linearRegression(ys: number[]): { slope: number; intercept: number } {
      const n = ys.length;
      if (n < 2) return { slope: 0, intercept: ys[0] || 0 };
      const xs = ys.map((_, i) => i);
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const sumX2 = xs.reduce((a, x) => a + x * x, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
      const intercept = (sumY - slope * sumX) / n;
      return { slope, intercept };
    }

    // Exponential Smoothing for seasonality
    function expSmoothing(ys: number[], alpha = 0.3): number[] {
      if (ys.length === 0) return [];
      const result = [ys[0]];
      for (let i = 1; i < ys.length; i++) {
        result.push(alpha * ys[i] + (1 - alpha) * result[i - 1]);
      }
      return result;
    }

    // Use last 30 days as baseline for forecasting
    const baseline = historicalDays.slice(-30);
    const forecastDays = 30;

    function forecastMetric(values: number[]): number[] {
      const smoothed = expSmoothing(values);
      const { slope, intercept } = linearRegression(smoothed);
      const n = values.length;
      const projections: number[] = [];
      for (let i = 0; i < forecastDays; i++) {
        const projected = Math.max(0, slope * (n + i) + intercept);
        projections.push(Math.round(projected * 100) / 100);
      }
      return projections;
    }

    const requestsBaseline = baseline.map(d => d.requests);
    const tokensBaseline = baseline.map(d => d.tokens);
    const costBaseline = baseline.map(d => d.cost);
    const usersBaseline = baseline.map(d => d.totalUsers);
    const newUsersBaseline = baseline.map(d => d.newUsers);

    const forecastedRequests = forecastMetric(requestsBaseline);
    const forecastedTokens = forecastMetric(tokensBaseline);
    const forecastedCost = forecastMetric(costBaseline);
    const forecastedTotalUsers = forecastMetric(usersBaseline);
    const forecastedNewUsers = forecastMetric(newUsersBaseline);

    // Build forecast day objects
    const lastDate = baseline.length > 0 ? new Date(baseline[baseline.length - 1].date) : new Date();
    const forecastData = Array.from({ length: forecastDays }, (_, i) => {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i + 1);
      return {
        date: d.toISOString().split('T')[0],
        requests: forecastedRequests[i],
        tokens: forecastedTokens[i],
        cost: forecastedCost[i],
        totalUsers: Math.round(forecastedTotalUsers[i]),
        newUsers: Math.max(0, Math.round(forecastedNewUsers[i])),
      };
    });

    // Summary projections
    const totalForecastedRequests = forecastedRequests.reduce((a, b) => a + b, 0);
    const totalForecastedTokens = forecastedTokens.reduce((a, b) => a + b, 0);
    const totalForecastedCost = forecastedCost.reduce((a, b) => a + b, 0);
    const totalForecastedNewUsers = forecastedNewUsers.reduce((a, b) => a + Math.max(0, b), 0);

    const last30Requests = baseline.reduce((a, d) => a + d.requests, 0);
    const last30Tokens = baseline.reduce((a, d) => a + d.tokens, 0);
    const last30Cost = baseline.reduce((a, d) => a + d.cost, 0);
    const last30NewUsers = baseline.reduce((a, d) => a + d.newUsers, 0);

    return NextResponse.json({
      historical: historicalDays,
      forecast: forecastData,
      projections: {
        next30Days: {
          requests: Math.round(totalForecastedRequests),
          tokens: Math.round(totalForecastedTokens),
          cost: Math.round(totalForecastedCost * 100) / 100,
          newUsers: Math.round(totalForecastedNewUsers),
          projectedTotalUsers: forecastData[forecastData.length - 1]?.totalUsers || cumUsers,
        },
        last30Days: {
          requests: last30Requests,
          tokens: last30Tokens,
          cost: Math.round(last30Cost * 100) / 100,
          newUsers: last30NewUsers,
          totalUsers: cumUsers,
        },
        growthRates: {
          requests: last30Requests > 0 ? Math.round(((totalForecastedRequests - last30Requests) / last30Requests) * 100) : 0,
          tokens: last30Tokens > 0 ? Math.round(((totalForecastedTokens - last30Tokens) / last30Tokens) * 100) : 0,
          cost: last30Cost > 0 ? Math.round(((totalForecastedCost - last30Cost) / last30Cost) * 100) : 0,
          users: last30NewUsers > 0 ? Math.round(((totalForecastedNewUsers - last30NewUsers) / last30NewUsers) * 100) : 0,
        },
      },
    });
  } catch (error) {
    console.error('Forecast error:', error);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
