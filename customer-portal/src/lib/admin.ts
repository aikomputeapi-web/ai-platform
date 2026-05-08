import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from './db';

export const ADMIN_SECRET = process.env.ADMIN_API_SECRET || process.env.OMNIROUTE_INITIAL_PASSWORD || 'admin';

export function getAdminSecret(): string {
  return ADMIN_SECRET;
}

export function verifyAdminAccess(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  return authHeader.slice(7) === ADMIN_SECRET;
}

export function adminForbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export function getRequestIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }
  return req.headers.get('x-real-ip');
}

type AuditActionInput = {
  action: string;
  req?: NextRequest;
  actor?: string;
  targetUserId?: string | null;
  targetUserEmail?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export async function recordAdminAction(input: AuditActionInput) {
  try {
    const metadataSql = input.metadata
      ? Prisma.sql`${JSON.stringify(input.metadata)}::jsonb`
      : Prisma.sql`NULL`;

    await prisma.$executeRaw`
      INSERT INTO "audit_logs" (
        "action",
        "actor",
        "target_user_id",
        "target_user_email",
        "metadata",
        "ip_address"
      ) VALUES (
        ${input.action},
        ${input.actor || 'admin'},
        ${input.targetUserId || null},
        ${input.targetUserEmail || null},
        ${metadataSql},
        ${input.req ? getRequestIp(input.req) : null}
      )
    `;
  } catch (error) {
    console.error('Failed to record admin action:', error);
  }
}
