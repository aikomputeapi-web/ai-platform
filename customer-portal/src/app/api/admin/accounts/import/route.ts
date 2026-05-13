import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

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

    for (const rawRow of rows) {
      const email = String(rawRow?.email || '').trim().toLowerCase();
      if (!email) continue;

      const name = rawRow?.name ? String(rawRow.name).trim() : null;
      const planId = rawRow?.planId && planIds.has(rawRow.planId) ? rawRow.planId : 'free';
      const emailVerified = !!rawRow?.emailVerified;
      const isLocked = !!rawRow?.isLocked;
      const adminNote = rawRow?.adminNote ? String(rawRow.adminNote).trim() : null;

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
          } as never,
        });
        updated += 1;
      } else {
        await prisma.user.create({
          data: {
            id: randomUUID(),
            email,
            passwordHash: await hashPassword(randomUUID()),
            name,
            planId,
            emailVerified,
            isLocked,
            adminNote,
          } as never,
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
