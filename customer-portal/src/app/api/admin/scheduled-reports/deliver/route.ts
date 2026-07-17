import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';
import { timingSafeEqualStrings } from '@/lib/admin-session';
import { getNextRunAt, sendScheduledReportEmail, type ScheduledReportRecord } from '@/lib/scheduled-reports';

export const dynamic = 'force-dynamic';

async function verifyDeliveryAccess(req: NextRequest) {
  if (await verifyAdminAccess(req)) return true;

  const cronSecret = process.env.CRON_SECRET || process.env.SCHEDULED_REPORTS_CRON_SECRET;
  if (!cronSecret) return false;

  const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('x-scheduler-secret');
  if (!headerSecret) return false;
  return timingSafeEqualStrings(headerSecret, cronSecret);
}

async function isDeliveryEnabled() {
  const rows = await prisma.$queryRaw<Array<{ value: unknown }>>(Prisma.sql`
    SELECT value
    FROM admin_settings
    WHERE key = 'scheduled_reports_delivery'
    LIMIT 1
  `);

  const value = rows[0]?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return true;
  }

  return (value as Record<string, unknown>).enabled !== false;
}

export async function POST(req: NextRequest) {
  if (!(await verifyDeliveryAccess(req))) {
    return adminForbidden();
  }

  try {
    const source = req.nextUrl.searchParams.get('source') || 'manual';
    const deliveryEnabled = await isDeliveryEnabled();
    if (!deliveryEnabled && source === 'worker') {
      return NextResponse.json({ success: true, processed: 0, sent: 0, failed: 0, skipped: 0, paused: true });
    }

    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitParam || 20) || 20, 1), 100);

    const dueReports = await prisma.$queryRaw<ScheduledReportRecord[]>(Prisma.sql`
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
        next_run_at AS "nextRunAt"
      FROM scheduled_reports
      WHERE enabled = true
        AND next_run_at IS NOT NULL
        AND next_run_at <= NOW()
      ORDER BY next_run_at ASC, created_at ASC
      LIMIT ${limit}
    `);

    const results = {
      processed: dueReports.length,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const report of dueReports) {
      let delivered = false;
      try {
        delivered = await sendScheduledReportEmail(report);
      } catch (error) {
        // Report builders query the DB (and upstream analytics) and throw on
        // failure rather than returning false. Without this catch, one
        // throwing report aborts the rest of the batch and keeps its past-due
        // next_run_at, starving every report behind it on each run.
        console.error(`Scheduled report ${report.id} delivery threw:`, error);
      }
      if (!delivered) {
        results.failed += 1;
        // Push the next attempt out instead of leaving next_run_at in the
        // past: the query above takes the LIMIT oldest due reports, so
        // reports that fail every run would otherwise fill the batch forever
        // and starve healthy ones. One hour keeps retries frequent relative
        // to the daily/weekly/monthly cadences without burning email quota.
        await prisma.$executeRaw(Prisma.sql`
          UPDATE scheduled_reports
          SET next_run_at = NOW() + INTERVAL '1 hour',
              updated_at = NOW()
          WHERE id = ${report.id}
        `);
        await recordAdminAction({
          action: 'report.delivery_failed',
          req,
          metadata: {
            reportId: report.id,
            reportType: report.reportType,
            recipientEmail: report.recipientEmail,
          },
        });
        continue;
      }

      results.sent += 1;

      await prisma.$executeRaw(Prisma.sql`
        UPDATE scheduled_reports
        SET last_run_at = NOW(),
            next_run_at = ${report.enabled ? getNextRunAt(report.cadence) : null},
            updated_at = NOW()
        WHERE id = ${report.id}
      `);

      await recordAdminAction({
        action: 'report.sent',
        req,
        metadata: {
          reportId: report.id,
          reportType: report.reportType,
          recipientEmail: report.recipientEmail,
          cadence: report.cadence,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...results,
      paused: !deliveryEnabled,
    });
  } catch (error) {
    console.error('Scheduled report delivery error:', error);
    return NextResponse.json({ error: 'Failed to deliver scheduled reports' }, { status: 500 });
  }
}
