import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { deleteOmniRouteKey, getUsageAnalytics } from '@/lib/omniroute';
import { createSessionToken, generateVerifyToken, hashPassword } from '@/lib/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/email';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

interface AuditLogRow {
  id: string;
  action: string;
  actor: string;
  targetUserId: string | null;
  targetUserEmail: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

function formatRange(range: string | null) {
  return range || '30d';
}

async function buildUserDetail(userId: string, range: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      plan: true,
      apiKeys: {
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) {
    return null;
  }
  const account = user as typeof user & { isLocked?: boolean; adminNote?: string | null };

  const analytics = await getUsageAnalytics(range);
  const usageByKeyId: Record<string, { requests?: number; totalTokens?: number; totalCost?: number; promptTokens?: number; completionTokens?: number; byModel?: { model: string; requests: number }[] }> = {};
  for (const entry of analytics?.byApiKey || []) {
    usageByKeyId[entry.apiKeyId] = entry;
  }

  const apiKeys = user.apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    lastFour: key.lastFour,
    isActive: key.isActive,
    createdAt: key.createdAt,
    usage: usageByKeyId[key.omnirouteKeyId] || null,
  }));

  const keyUsages = Object.values(usageByKeyId);
  const topModelsMap: Record<string, number> = {};
  for (const keyUsage of keyUsages) {
    for (const model of keyUsage.byModel || []) {
      topModelsMap[model.model] = (topModelsMap[model.model] || 0) + (model.requests || 0);
    }
  }

  const totalPaidCents = user.payments
    .filter((payment) => payment.status === 'succeeded' || payment.status === 'completed')
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  const recentAudit = await prisma.$queryRaw<AuditLogRow[]>(Prisma.sql`
    SELECT
      id,
      action,
      actor,
      target_user_id AS "targetUserId",
      target_user_email AS "targetUserEmail",
      metadata,
      ip_address AS "ipAddress",
      created_at AS "createdAt"
    FROM "audit_logs"
    WHERE target_user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 12
  `);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    isLocked: account.isLocked || false,
    adminNote: account.adminNote || null,
    stripeCustomerId: user.stripeCustomerId,
    plan: user.plan,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    apiKeys,
    payments: user.payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      planId: payment.planId,
      status: payment.status,
      createdAt: payment.createdAt,
    })),
    usage: {
      totalRequests: keyUsages.reduce((sum, entry) => sum + (entry.requests || 0), 0),
      totalTokens: keyUsages.reduce((sum, entry) => sum + (entry.totalTokens || 0), 0),
      totalCost: keyUsages.reduce((sum, entry) => sum + (entry.totalCost || 0), 0),
      promptTokens: keyUsages.reduce((sum, entry) => sum + (entry.promptTokens || 0), 0),
      completionTokens: keyUsages.reduce((sum, entry) => sum + (entry.completionTokens || 0), 0),
      topModels: Object.entries(topModelsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([model, requests]) => ({ model, requests })),
    },
    totalPaidCents,
    recentAudit,
    range,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const { id } = await params;
    const range = formatRange(req.nextUrl.searchParams.get('range'));
    const detail = await buildUserDetail(id, range);

    if (!detail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: detail, range });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const action = String(body?.action || '');

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        plan: true,
        apiKeys: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const account = user as typeof user & { isLocked?: boolean; adminNote?: string | null };

    let response: Record<string, unknown> = {};
    let impersonationToken: string | null = null;

    switch (action) {
      case 'lock': {
        const updated = await prisma.user.update({
          where: { id },
          data: {
            isLocked: true,
            adminNote: body?.note?.trim() || account.adminNote,
          } as never,
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: 'user.locked',
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: body?.note ? { note: body.note } : null,
        });
        response = { user: updated };
        break;
      }
      case 'unlock': {
        const updated = await prisma.user.update({
          where: { id },
          data: { isLocked: false } as never,
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: 'user.unlocked',
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { user: updated };
        break;
      }
      case 'plan': {
        const planId = String(body?.planId || '');
        if (!planId) {
          return NextResponse.json({ error: 'planId is required' }, { status: 400 });
        }
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
          return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }
        const updated = await prisma.user.update({
          where: { id },
          data: { planId },
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: 'user.plan_changed',
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: { planId, planName: plan.name },
        });
        response = { user: updated };
        break;
      }
      case 'note': {
        const note = String(body?.note || '').trim();
        const updated = await prisma.user.update({
          where: { id },
          data: { adminNote: note || null } as never,
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: 'user.note_updated',
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: note ? { note } : null,
        });
        response = { user: updated };
        break;
      }
      case 'revokeKeys': {
        const activeKeys = user.apiKeys.filter((key) => key.isActive);
        await Promise.allSettled(
          activeKeys.map((key) => deleteOmniRouteKey(key.omnirouteKeyId))
        );
        await prisma.userApiKey.updateMany({
          where: { userId: id },
          data: { isActive: false },
        });
        const updated = await prisma.user.findUnique({
          where: { id },
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: 'user.keys_revoked',
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: { revokedKeys: activeKeys.length },
        });
        response = { user: updated };
        break;
      }
      case 'resendVerification': {
        if (user.emailVerified) {
          return NextResponse.json({ error: 'User is already verified' }, { status: 400 });
        }

        const verifyToken = user.verifyToken || generateVerifyToken();
        const updated = await prisma.user.update({
          where: { id },
          data: { verifyToken } as never,
          include: { plan: true, apiKeys: true, payments: true },
        });
        await sendVerificationEmail(user.email, verifyToken);
        await recordAdminAction({
          action: 'support.verification_resent',
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { user: updated };
        break;
      }
      case 'resetPassword': {
        const resetToken = generateVerifyToken();
        const resetTokenExp = new Date();
        resetTokenExp.setHours(resetTokenExp.getHours() + 1);

        const updated = await prisma.user.update({
          where: { id },
          data: { resetToken, resetTokenExp } as never,
          include: { plan: true, apiKeys: true, payments: true },
        });
        await sendPasswordResetEmail(user.email, resetToken);
        await recordAdminAction({
          action: 'support.password_reset_sent',
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { user: updated };
        break;
      }
      case 'impersonate': {
        impersonationToken = await createSessionToken(user.id);
        await recordAdminAction({
          action: 'support.impersonate',
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { url: '/dashboard' };
        break;
      }
      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const result = NextResponse.json({ success: true, ...response });
    if (impersonationToken) {
      result.cookies.set('portal_impersonation_session', impersonationToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
    }
    return result;
  } catch (error) {
    console.error('Admin user action error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { apiKeys: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await Promise.allSettled(
      user.apiKeys.map((key) => deleteOmniRouteKey(key.omnirouteKeyId))
    );

    await prisma.$transaction([
      prisma.userApiKey.updateMany({
        where: { userId: id },
        data: { isActive: false },
      }),
      prisma.user.update({
        where: { id },
        data: {
          email: `${user.email}.deleted.${user.id.slice(0, 8)}`,
          passwordHash: await hashPassword(generateVerifyToken()),
          name: null,
          emailVerified: false,
          isLocked: true,
          adminNote: null,
          verifyToken: null,
          resetToken: null,
          resetTokenExp: null,
          stripeCustomerId: null,
          planId: 'free',
        } as never,
      }),
    ]);

    await recordAdminAction({
      action: 'user.deleted',
      req,
      targetUserId: user.id,
      targetUserEmail: user.email,
      metadata: { apiKeysRevoked: user.apiKeys.length },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin user delete error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
