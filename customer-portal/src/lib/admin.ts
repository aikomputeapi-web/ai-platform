import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from './db';
import { getAdminSecret, timingSafeEqualStrings, verifyAdminSession } from './admin-session';

export async function verifyAdminAccess(req: NextRequest): Promise<boolean> {
  // Check for session cookie (new session-based auth)
  const sessionToken = req.cookies.get('admin_session')?.value;
  if (sessionToken) {
    return await verifyAdminSession(sessionToken);
  }

  // Fallback to old Bearer token auth for backwards compatibility.
  // getAdminSecret throws in production when ADMIN_API_SECRET is unset, so a
  // misconfigured deployment fails loudly instead of accepting "Bearer admin".
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return timingSafeEqualStrings(authHeader.slice(7), getAdminSecret());
  }

  return false;
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
