import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyAdminAccess } from '@/lib/admin';
import { getUsageAnalytics } from '@/lib/omniroute';
import { calculateOfficialCost } from '@/lib/models';

export const dynamic = 'force-dynamic';

interface ApiKeyUsage {
  apiKeyId: string;
  apiKey?: string;
  apiKeyName?: string;
  historicalApiKeyNames?: string[];
  requests?: number;
  totalTokens?: number;
  cost?: number;
  totalCost?: number;
  promptTokens?: number;
  completionTokens?: number;
  byModel?: { model: string; requests: number }[];
}

function normalizeUsageLookupKey(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function indexApiKeyUsage(
  usageByKeyId: Record<string, ApiKeyUsage>,
  usageByName: Map<string, ApiKeyUsage>,
  entry: ApiKeyUsage
) {
  if (entry.apiKeyId) {
    usageByKeyId[entry.apiKeyId] = entry;
  }

  const apiKeyNames = [entry.apiKeyName, entry.apiKey, ...(entry.historicalApiKeyNames || [])];
  for (const name of apiKeyNames) {
    const normalized = normalizeUsageLookupKey(name);
    if (normalized && !usageByName.has(normalized)) {
      usageByName.set(normalized, entry);
    }
  }
}

function resolvePortalKeyUsage(
  usageByKeyId: Record<string, ApiKeyUsage>,
  usageByName: Map<string, ApiKeyUsage>,
  apiKeyId: string,
  portalKeyName: string
) {
  const byId = usageByKeyId[apiKeyId];
  if (byId) return byId;

  const byName = usageByName.get(normalizeUsageLookupKey(portalKeyName));
  return byName || null;
}

/**
 * Admin Analytics API
 * 
 * Returns a comprehensive view of all registered users, their API keys,
 * payment history, and usage statistics pulled from OmniRoute.
 * 
 * Protected by shared admin session authentication.
 */

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
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
    const usageByKeyId: Record<string, ApiKeyUsage> = {};
    const usageByName = new Map<string, ApiKeyUsage>();
    if (analytics?.byApiKey) {
      for (const entry of analytics.byApiKey) {
        indexApiKeyUsage(usageByKeyId, usageByName, entry);
      }
    }

    // 5. Enrich each user with their aggregated usage
    const enrichedUsers = users.map(user => {
      const account = user as typeof user & { isLocked?: boolean; adminNote?: string | null };
      const keyUsages = user.apiKeys
        .map((key) =>
          resolvePortalKeyUsage(
            usageByKeyId,
            usageByName,
            key.omnirouteKeyId,
            `${user.email} - ${key.name}`
          )
        )
        .filter((entry): entry is ApiKeyUsage => Boolean(entry));

      const totalTokens = keyUsages.reduce((sum: number, k: ApiKeyUsage) => sum + (k.totalTokens || 0), 0);
      const totalRequests = keyUsages.reduce((sum: number, k: ApiKeyUsage) => sum + (k.requests || 0), 0);
      
      let userTotalCost = 0;
      for (const k of keyUsages) {
        let keyCost = k.cost || k.totalCost || 0;
        if (keyCost === 0 && (k.promptTokens || k.completionTokens)) {
          const topModel = k.byModel?.sort((a: any, b: any) => b.requests - a.requests)[0]?.model;
          keyCost = calculateOfficialCost(topModel, k.promptTokens || 0, k.completionTokens || 0);
        }
        k.totalCost = keyCost;
        k.cost = keyCost;
        userTotalCost += keyCost;
      }

      const promptTokens = keyUsages.reduce((sum: number, k: ApiKeyUsage) => sum + (k.promptTokens || 0), 0);
      const completionTokens = keyUsages.reduce((sum: number, k: ApiKeyUsage) => sum + (k.completionTokens || 0), 0);

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
        isLocked: account.isLocked || false,
        isShadowLocked: (account as any).isShadowLocked || false,
        isShadowBanned: (account as any).isShadowBanned || false,
        adminNote: account.adminNote || null,
        plan: user.plan,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        apiKeys: user.apiKeys.map(k => {
          const usage =
            resolvePortalKeyUsage(
              usageByKeyId,
              usageByName,
              k.omnirouteKeyId,
              `${user.email} - ${k.name}`
            ) || null;
          if (usage) {
            let keyCost = usage.cost || usage.totalCost || 0;
            if (keyCost === 0 && (usage.promptTokens || usage.completionTokens)) {
              const topModel = usage.byModel?.sort((a: any, b: any) => b.requests - a.requests)[0]?.model;
              keyCost = calculateOfficialCost(topModel, usage.promptTokens || 0, usage.completionTokens || 0);
            }
            usage.totalCost = keyCost;
            usage.cost = keyCost;
          }
          return {
            id: k.id,
            name: k.name,
            lastFour: k.lastFour,
            isActive: k.isActive,
            createdAt: k.createdAt,
            usage,
          };
        }),
        payments: user.payments,
        usage: {
          totalTokens,
          totalRequests,
          totalCost: userTotalCost,
          promptTokens,
          completionTokens,
          topModels,
        },
        totalPaidCents: totalPaid,
      };
    });

    // 6. Platform-wide aggregates
    const matchedRequests = enrichedUsers.reduce((sum, user) => sum + (user.usage.totalRequests || 0), 0);
    const matchedTokens = enrichedUsers.reduce((sum, user) => sum + (user.usage.totalTokens || 0), 0);
    const matchedCost = enrichedUsers.reduce((sum, user) => sum + (user.usage.totalCost || 0), 0);
    const totalRequests = analytics?.summary?.totalRequests || 0;
    const totalTokens = analytics?.summary?.totalTokens || 0;
    
    // Recalculate platform-wide cost based on model breakdown for precision
    let platformTotalCost = 0;
    if (analytics?.byModel) {
      for (const m of analytics.byModel) {
        platformTotalCost += calculateOfficialCost(m.model, m.promptTokens || 0, m.completionTokens || 0);
      }
    } else {
      platformTotalCost = analytics?.summary?.totalCost || 0;
    }

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
      totalRequests,
      totalTokens,
      totalCost: platformTotalCost,
      matchedRequests,
      matchedTokens,
      matchedCost,
      unmatchedRequests: Math.max(0, totalRequests - matchedRequests),
      unmatchedTokens: Math.max(0, totalTokens - matchedTokens),
      unmatchedCost: Math.max(0, platformTotalCost - matchedCost),
      coveragePct: totalRequests > 0 ? Number(((matchedRequests / totalRequests) * 100).toFixed(2)) : 0,
      planBreakdown: plans.map(p => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        userCount: p._count.users,
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
