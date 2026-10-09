import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuth();
    const entries = await prisma.billingAdjustment.findMany({
      where: { userId: user.id, type: { in: ['account_credit', 'account_credit_refund'] } },
      orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, type: true, amountCents: true, reason: true, createdAt: true },
    });
    const totals = await prisma.billingAdjustment.aggregate({
      where: { userId: user.id, type: { in: ['account_credit', 'account_credit_refund'] } },
      _sum: { amountCents: true },
    });
    return NextResponse.json({ balanceCents: totals._sum.amountCents ?? 0, entries });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Account credit lookup failed:', error);
    return NextResponse.json({ error: 'Could not load account credit' }, { status: 500 });
  }
}
