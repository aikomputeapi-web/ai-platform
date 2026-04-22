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

    const keyIds = new Set(userKeys.map(k => k.omnirouteKeyId));

    // Get full analytics from OmniRoute
    const analytics = await getUsageAnalytics(range);

    if (!analytics) {
      return NextResponse.json({
        summary: { totalTokens: 0, totalRequests: 0, totalCost: 0 },
        dailyTrend: [],
        byModel: [],
      });
    }

    // Filter byApiKey to only this user's keys
    const userApiKeyUsage = (analytics.byApiKey || []).filter((k: any) =>
      keyIds.has(k.apiKeyId)
    );

    // Recalculate summary from user's keys only
    const summary = {
      totalTokens: userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.totalTokens || 0), 0),
      totalRequests: userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.requests || 0), 0),
      totalCost: userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.cost || 0), 0),
      promptTokens: userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.promptTokens || 0), 0),
      completionTokens: userApiKeyUsage.reduce((sum: number, k: any) => sum + (k.completionTokens || 0), 0),
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
