import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const RANGE_TO_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function getRangeCutoff(range: string | null) {
  const days = RANGE_TO_DAYS[range || '30d'] || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

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

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const range = req.nextUrl.searchParams.get('range');
    const action = req.nextUrl.searchParams.get('action');
    const search = (req.nextUrl.searchParams.get('search') || '').trim();
    const cutoff = getRangeCutoff(range);

    const conditions: Prisma.Sql[] = [Prisma.sql`created_at >= ${cutoff}`];
    if (action && action !== 'all') {
      conditions.push(Prisma.sql`action = ${action}`);
    }
    if (search) {
      const like = `%${search}%`;
      conditions.push(Prisma.sql`
        (
          action ILIKE ${like}
          OR actor ILIKE ${like}
          OR target_user_email ILIKE ${like}
        )
      `);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const logs = await prisma.$queryRaw<AuditLogRow[]>(Prisma.sql`
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
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT 250
    `);

    return NextResponse.json({
      range: range || '30d',
      logs: logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 });
  }
}
