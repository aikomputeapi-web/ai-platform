import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

async function isEmailDotShadowbanEnabled(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ value: unknown }>>(
    Prisma.sql`SELECT value FROM admin_settings WHERE key = 'email_dot_shadowban' LIMIT 1`
  );
  const row = rows[0];
  if (!row || typeof row.value !== 'object' || row.value === null || Array.isArray(row.value)) return false;
  return (row.value as Record<string, unknown>).enabled === true;
}

export const dynamic = 'force-dynamic';

interface AccountImportRow {
  email: string;
  name?: string | null;
  planId?: string | null;
  emailVerified?: boolean;
  isLocked?: boolean;
  adminNote?: string | null;
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows as AccountImportRow[] : [];

    if (!rows.length) {
      return NextResponse.json({ error: 'rows is required' }, { status: 400 });
    }

    const plans = await prisma.plan.findMany({ select: { id: true } });
    const planIds = new Set(plans.map((plan) => plan.id));

    let created = 0;
    let updated = 0;

    // Check once before the loop — defaults to off when no DB row exists
    const dotRuleEnabled = await isEmailDotShadowbanEnabled();

    for (const rawRow of rows) {
      const email = String(rawRow?.email || '').trim().toLowerCase();
      if (!email) continue;

      const name = rawRow?.name ? String(rawRow.name).trim() || null : null;
      const planId = rawRow?.planId && planIds.has(rawRow.planId) ? rawRow.planId : 'free';
      const emailVerified = !!rawRow?.emailVerified;
      const isLocked = !!rawRow?.isLocked;
      const adminNote = rawRow?.adminNote ? String(rawRow.adminNote).trim() || null : null;

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing) {
        await prisma.user.update({
          where: { email },
          data: {
            name,
            planId,
            emailVerified,
            isLocked,
            adminNote,
          },
        });
        updated += 1;
      } else {
        const parts = email.split('@');
        const username = parts[0] || '';
        const domain = parts[1] || '';
        const dotCount = (username.match(/\./g) || []).length;

        const isShadowLocked = false;
        let isShadowBanned = false;
        let finalAdminNote = adminNote;

        const isGmail = domain.toLowerCase() === 'gmail.com' || domain.toLowerCase() === 'googlemail.com';
        if (dotRuleEnabled && isGmail && dotCount >= 4) {
          isShadowBanned = true;
          finalAdminNote = adminNote || `Automatically shadow banned: Gmail account with ${dotCount} dots in email local part.`;
        }

        await prisma.user.create({
          data: {
            id: randomUUID(),
            email,
            passwordHash: await hashPassword(randomUUID()),
            name,
            planId,
            emailVerified,
            isLocked,
            isShadowLocked,
            isShadowBanned,
            adminNote: finalAdminNote,
          },
        });
        created += 1;
      }
    }

    await recordAdminAction({
      action: 'account.imported',
      req,
      metadata: { created, updated, total: rows.length },
    });

    return NextResponse.json({ success: true, created, updated, total: rows.length });
  } catch (error) {
    console.error('Account import error:', error);
    return NextResponse.json({ error: 'Failed to import accounts' }, { status: 500 });
  }
}
