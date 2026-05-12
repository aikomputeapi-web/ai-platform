import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const RANGE_TO_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function getCutoff(range: string | null) {
  const days = RANGE_TO_DAYS[range || '30d'] || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

interface BillingAdjustmentRow {
  id: string;
  userId: string;
  customerEmail: string;
  customerName: string | null;
  type: string;
  amountCents: number;
  reason: string;
  status: string;
  actor: string;
  createdAt: Date;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminAccess(req)) {
    return adminForbidden();
  }

  try {
    const range = req.nextUrl.searchParams.get('range');
    const cutoff = getCutoff(range);

    const [users, plans, payments, adjustments] = await Promise.all([
      prisma.user.findMany({
        include: {
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.plan.findMany({
        include: { _count: { select: { users: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.payment.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              planId: true,
              stripeCustomerId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
      prisma.$queryRaw<BillingAdjustmentRow[]>(Prisma.sql`
        SELECT
          a.id,
          a.user_id AS "userId",
          u.email AS "customerEmail",
          u.name AS "customerName",
          a.type,
          a.amount_cents AS "amountCents",
          a.reason,
          a.status,
          a.actor,
          a.created_at AS "createdAt"
        FROM billing_adjustments a
        JOIN users u ON u.id = a.user_id
        WHERE a.created_at >= ${cutoff}
        ORDER BY a.created_at DESC
        LIMIT 50
      `),
    ]);

    const successful = payments.filter((payment) => payment.status === 'succeeded' || payment.status === 'completed');
    const failed = payments.filter((payment) => payment.status === 'failed' || payment.status === 'canceled');
    const pending = payments.filter((payment) => payment.status === 'pending');

    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const recentInvoices = payments.slice(0, 100).map((payment) => {
      const plan = payment.planId ? planById.get(payment.planId) : null;
      return {
        id: payment.id,
        invoiceId: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
        customerEmail: payment.user.email,
        customerName: payment.user.name,
        customerId: payment.user.id,
        planId: payment.planId,
        planName: plan?.name || payment.user.planId || 'Unknown',
        amountCents: payment.amountCents,
        status: payment.status,
        createdAt: payment.createdAt,
        stripePaymentId: payment.stripePaymentId,
      };
    });

    const activeCustomers = users.filter((user) => user.plan.priceCents > 0);
    const mrrCents = activeCustomers.reduce((sum, user) => sum + user.plan.priceCents, 0);
    const revenueCents = successful.reduce((sum, payment) => sum + payment.amountCents, 0);
    const monthlyRevenueCents = successful
      .filter((payment) => payment.createdAt >= cutoff)
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const monthlyPayments = payments.filter((payment) => payment.createdAt >= cutoff).length;
    const pastDueCustomers = users.filter((user) =>
      payments.some((payment) =>
        payment.userId === user.id && (payment.status === 'failed' || payment.status === 'canceled')
      )
    );

    const creditCents = adjustments
      .filter((adjustment) => adjustment.type === 'credit')
      .reduce((sum, adjustment) => sum + adjustment.amountCents, 0);
    const refundCents = adjustments
      .filter((adjustment) => adjustment.type === 'refund')
      .reduce((sum, adjustment) => sum + adjustment.amountCents, 0);

    return NextResponse.json({
      range: range || '30d',
      summary: {
        totalRevenueCents: revenueCents,
        monthlyRevenueCents,
        mrrCents,
        activeCustomers: activeCustomers.length,
        totalCustomers: users.length,
        completedPayments: successful.length,
        failedPayments: failed.length,
        pendingPayments: pending.length,
        monthlyPayments,
        pastDueCustomers: pastDueCustomers.length,
        creditCents,
        refundCents,
        adjustmentCount: adjustments.length,
      },
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceCents: plan.priceCents,
        userCount: plan._count.users,
        requestsPerDay: plan.requestsPerDay,
        requestsPerMinute: plan.requestsPerMinute,
        requestsPerMonth: (plan as typeof plan & { requestsPerMonth?: number }).requestsPerMonth || 0,
      })),
      recentInvoices,
      failedPayments: failed.slice(0, 25).map((payment) => ({
        id: payment.id,
        customerEmail: payment.user.email,
        customerName: payment.user.name,
        amountCents: payment.amountCents,
        status: payment.status,
        createdAt: payment.createdAt,
        planId: payment.planId,
      })),
      customerBilling: users.slice(0, 50).map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        stripeCustomerId: user.stripeCustomerId,
        lastPaymentAt: user.payments[0]?.createdAt || null,
        hasFailedPayment: payments.some((payment) => payment.userId === user.id && payment.status === 'failed'),
        totalPaidCents: user.payments
          .filter((payment) => payment.status === 'succeeded' || payment.status === 'completed')
          .reduce((sum, payment) => sum + payment.amountCents, 0),
      })),
      adjustments: adjustments.map((adjustment) => ({
        ...adjustment,
        createdAt: adjustment.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Admin billing error:', error);
    return NextResponse.json({ error: 'Failed to load billing data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminAccess(req)) {
    return adminForbidden();
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '');
    const userId = String(body?.userId || '');
    const amountCents = Number(body?.amountCents || 0);
    const reason = String(body?.reason || '').trim();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!['credit', 'refund'].includes(action)) {
      return NextResponse.json({ error: 'Unsupported billing action' }, { status: 400 });
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'amountCents must be a positive number' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const id = randomUUID();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO billing_adjustments (id, user_id, type, amount_cents, reason, status, actor, created_at)
      VALUES (${id}, ${userId}, ${action}, ${amountCents}, ${reason}, 'applied', 'admin', NOW())
    `);

    await recordAdminAction({
      action: action === 'credit' ? 'billing.credit_created' : 'billing.refund_created',
      req,
      targetUserId: user.id,
      targetUserEmail: user.email,
      metadata: { amountCents, reason },
    });

    return NextResponse.json({
      success: true,
      adjustment: {
        id,
        userId,
        customerEmail: user.email,
        customerName: user.name,
        type: action,
        amountCents,
        reason,
        status: 'applied',
        actor: 'admin',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin billing action error:', error);
    return NextResponse.json({ error: 'Failed to create billing adjustment' }, { status: 500 });
  }
}
