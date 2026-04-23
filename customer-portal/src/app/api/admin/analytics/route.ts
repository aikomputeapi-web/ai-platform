import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getUsageAnalytics } from '@/lib/omniroute';

export const dynamic = 'force-dynamic';

/**
 * Admin Analytics API
 * 
 * Returns a comprehensive view of all registered users, their API keys,
 * payment history, and usage statistics pulled from OmniRoute.
 * 
 * Protected by a simple admin secret passed as a Bearer token.
 * In production, replace this with proper role-based auth.
 */

function verifyAdminAccess(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_API_SECRET || process.env.OMNIROUTE_INITIAL_PASSWORD || 'admin';
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === adminSecret;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminAccess(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const range = req.nextUrl.searchParams.get('range') || '30d';

    // 1. Fetch all users with their plans, keys, and payments
    const users = await prisma.user.findMany({
      include: {
        plan: true,
        apiKeys: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch all plans
    const plans = await prisma.plan.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    // 3. Fetch aggregate usage data from OmniRoute
    const analytics = await getUsageAnalytics(range);

    // 4. Build a lookup: omnirouteKeyId -> usage stats
    const usageByKeyId: Record<string, any> = {};
    if (analytics?.byApiKey) {
      for (const entry of analytics.byApiKey) {
        usageByKeyId[entry.apiKeyId] = entry;
      }
    }

    // 5. Enrich each user with their aggregated usage
    const enrichedUsers = users.map(user => {
      const userKeyIds = user.apiKeys.map(k => k.omnirouteKeyId);
      const keyUsages = userKeyIds
        .map(id => usageByKeyId[id])
        .filter(Boolean);

      const totalTokens = keyUsages.reduce((sum: number, k: any) => sum + (k.totalTokens || 0), 0);
      const totalRequests = keyUsages.reduce((sum: number, k: any) => sum + (k.requests || 0), 0);
      const totalCost = keyUsages.reduce((sum: number, k: any) => sum + (k.cost || 0), 0);
      const promptTokens = keyUsages.reduce((sum: number, k: any) => sum + (k.promptTokens || 0), 0);
      const completionTokens = keyUsages.reduce((sum: number, k: any) => sum + (k.completionTokens || 0), 0);

      // Per-model breakdown for this user
      const modelUsage: Record<string, number> = {};
      for (const k of keyUsages) {
        if (k.byModel) {
          for (const m of k.byModel) {
            modelUsage[m.model] = (modelUsage[m.model] || 0) + (m.requests || 0);
          }
        }
      }
      const topModels = Object.entries(modelUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([model, requests]) => ({ model, requests }));

      const totalPaid = user.payments
        .filter(p => p.status === 'succeeded' || p.status === 'completed')
        .reduce((sum, p) => sum + p.amountCents, 0);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        plan: user.plan,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        apiKeys: user.apiKeys.map(k => ({
          id: k.id,
          name: k.name,
          lastFour: k.lastFour,
          isActive: k.isActive,
          createdAt: k.createdAt,
          usage: usageByKeyId[k.omnirouteKeyId] || null,
        })),
        payments: user.payments,
        usage: {
          totalTokens,
          totalRequests,
          totalCost,
          promptTokens,
          completionTokens,
          topModels,
        },
        totalPaidCents: totalPaid,
      };
    });

    // 6. Platform-wide aggregates
    const platformSummary = {
      totalUsers: users.length,
      verifiedUsers: users.filter(u => u.emailVerified).length,
      totalApiKeys: users.reduce((sum, u) => sum + u.apiKeys.length, 0),
      activeApiKeys: users.reduce(
        (sum, u) => sum + u.apiKeys.filter(k => k.isActive).length,
        0
      ),
      totalRevenueCents: users.reduce(
        (sum, u) =>
          sum +
          u.payments
            .filter(p => p.status === 'succeeded' || p.status === 'completed')
            .reduce((s, p) => s + p.amountCents, 0),
        0
      ),
      totalRequests: analytics?.summary?.totalRequests || 0,
      totalTokens: analytics?.summary?.totalTokens || 0,
      totalCost: analytics?.summary?.totalCost || 0,
      planBreakdown: plans.map(p => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        userCount: (p as any)._count?.users || 0,
      })),
    };

    return NextResponse.json({
      summary: platformSummary,
      users: enrichedUsers,
      globalAnalytics: {
        dailyTrend: analytics?.dailyTrend || [],
        byModel: analytics?.byModel || [],
      },
      range,
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
