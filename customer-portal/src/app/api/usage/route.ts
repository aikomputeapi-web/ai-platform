import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUsageAnalytics } from '@/lib/omniroute';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const range = req.nextUrl.searchParams.get('range') || '30d';

    // Get user's OmniRoute key IDs
    const userKeys = await prisma.userApiKey.findMany({
      where: { userId: user.id },
      select: { omnirouteKeyId: true, name: true },
    });

    const keyIds = userKeys.map(k => k.omnirouteKeyId);

    if (keyIds.length === 0) {
      return NextResponse.json({
        summary: { totalTokens: 0, totalRequests: 0, totalCost: 0, promptTokens: 0, completionTokens: 0 },
        dailyTrend: [],
        byModel: [],
        byApiKey: [],
        range,
      });
    }

    // Get analytics from OmniRoute filtered by this user's API key IDs
    const analytics = await getUsageAnalytics(range, keyIds);

    if (!analytics) {
      return NextResponse.json({
        summary: { totalTokens: 0, totalRequests: 0, totalCost: 0, promptTokens: 0, completionTokens: 0 },
        dailyTrend: [],
        byModel: [],
        byApiKey: [],
        range,
      });
    }

    // Filter byApiKey to only this user's keys (defense-in-depth,
    // OmniRoute already filters by apiKeyIds but also matches on api_key_name)
    const keyIdSet = new Set(keyIds);
    const userApiKeyUsage = (analytics.byApiKey || []).filter((k: any) =>
      keyIdSet.has(k.apiKeyId)
    );

    // Use the server-side filtered summary from OmniRoute directly,
    // but fall back to aggregating from byApiKey if the summary includes
    // data from keys not belonging to this user
    const summary = {
      totalTokens: analytics.summary?.totalTokens || userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.totalTokens || 0), 0),
      totalRequests: analytics.summary?.totalRequests || userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.requests || 0), 0),
      totalCost: analytics.summary?.totalCost || userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.cost || 0), 0),
      promptTokens: analytics.summary?.promptTokens || userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.promptTokens || 0), 0),
      completionTokens: analytics.summary?.completionTokens || userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.completionTokens || 0), 0),
    };

    return NextResponse.json({
      summary,
      dailyTrend: analytics.dailyTrend || [],
      byModel: analytics.byModel || [],
      byApiKey: userApiKeyUsage,
      range,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Usage error:', error);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}

