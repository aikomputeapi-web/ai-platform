import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

interface ScheduledReportRow {
  id: string;
  name: string;
  reportType: string;
  recipientEmail: string;
  cadence: string;
  enabled: boolean;
  filters: unknown;
  notes: string | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DeliveryHistoryRow {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
}

function getNextRunAt(cadence: string) {
  const next = new Date();
  switch (cadence) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'daily':
    default:
      next.setDate(next.getDate() + 1);
      break;
  }
  return next;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const reports = await prisma.$queryRaw<ScheduledReportRow[]>(Prisma.sql`
      SELECT
        id,
        name,
        report_type AS "reportType",
        recipient_email AS "recipientEmail",
        cadence,
        enabled,
        filters,
        notes,
        last_run_at AS "lastRunAt",
        next_run_at AS "nextRunAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM scheduled_reports
      ORDER BY enabled DESC, next_run_at ASC NULLS LAST, created_at DESC
    `);

    const deliveryHistory = await prisma.$queryRaw<DeliveryHistoryRow[]>(Prisma.sql`
      SELECT
        id,
        action,
        metadata,
        created_at AS "createdAt"
      FROM audit_logs
      WHERE action IN ('report.sent', 'report.delivery_failed')
      ORDER BY created_at DESC
      LIMIT 30
    `);

    return NextResponse.json({
      reports: reports.map((report) => ({
        ...report,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
        lastRunAt: report.lastRunAt ? report.lastRunAt.toISOString() : null,
        nextRunAt: report.nextRunAt ? report.nextRunAt.toISOString() : null,
      })),
      deliveryHistory: deliveryHistory.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Scheduled reports fetch error:', error);
    return NextResponse.json({ error: 'Failed to load scheduled reports' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const reportType = String(body?.reportType || '').trim();
    const recipientEmail = String(body?.recipientEmail || '').trim();
    const cadence = ['daily', 'weekly', 'monthly'].includes(String(body?.cadence || 'daily'))
      ? String(body?.cadence || 'daily')
      : 'daily';
    const notes = body?.notes ? String(body.notes).trim() : null;
    const filters = body?.filters && typeof body.filters === 'object' ? body.filters : {};
    const enabled = body?.enabled === false ? false : true;

    if (!name || !reportType || !recipientEmail) {
      return NextResponse.json({ error: 'name, reportType, and recipientEmail are required' }, { status: 400 });
    }

    const id = randomUUID();
    const nextRunAt = enabled ? getNextRunAt(cadence) : null;

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO scheduled_reports (id, name, report_type, recipient_email, cadence, enabled, filters, notes, last_run_at, next_run_at, created_at, updated_at)
      VALUES (${id}, ${name}, ${reportType}, ${recipientEmail}, ${cadence}, ${enabled}, ${JSON.stringify(filters)}::jsonb, ${notes}, NULL, ${nextRunAt}, NOW(), NOW())
    `);

    await recordAdminAction({
      action: 'report.created',
      req,
      metadata: { name, reportType, recipientEmail, cadence, enabled },
    });

    return NextResponse.json({
      success: true,
      report: {
        id,
        name,
        reportType,
        recipientEmail,
        cadence,
        enabled,
        filters,
        notes,
        lastRunAt: null,
        nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
      },
    });
  } catch (error) {
    console.error('Scheduled report create error:', error);
    return NextResponse.json({ error: 'Failed to create scheduled report' }, { status: 500 });
  }
}
