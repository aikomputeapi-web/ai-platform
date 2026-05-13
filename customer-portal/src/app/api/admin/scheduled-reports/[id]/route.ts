import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';
import { getNextRunAt, sendScheduledReportEmail, type ScheduledReportRecord } from '@/lib/scheduled-reports';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.$queryRaw<Array<{
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
    }>>(Prisma.sql`
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
      WHERE id = ${id}
      LIMIT 1
    `);

    if (!existing.length) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const updates: Prisma.Sql[] = [Prisma.sql`updated_at = NOW()`];
    const metadata: Record<string, unknown> = {};
    let effectiveName = existing[0].name;
    let effectiveReportType = existing[0].reportType;
    let effectiveRecipientEmail = existing[0].recipientEmail;
    let effectiveCadence = existing[0].cadence;
    let effectiveEnabled = existing[0].enabled;
    let effectiveFilters = existing[0].filters;
    let effectiveNotes = existing[0].notes;

    if (typeof body?.name === 'string') {
      effectiveName = body.name.trim();
      updates.push(Prisma.sql`name = ${effectiveName}`);
      metadata.name = effectiveName;
    }
    if (typeof body?.reportType === 'string') {
      effectiveReportType = body.reportType.trim();
      updates.push(Prisma.sql`report_type = ${effectiveReportType}`);
      metadata.reportType = effectiveReportType;
    }
    if (typeof body?.recipientEmail === 'string') {
      effectiveRecipientEmail = body.recipientEmail.trim();
      updates.push(Prisma.sql`recipient_email = ${effectiveRecipientEmail}`);
      metadata.recipientEmail = effectiveRecipientEmail;
    }
    if (typeof body?.cadence === 'string') {
      effectiveCadence = ['daily', 'weekly', 'monthly'].includes(body.cadence) ? body.cadence : existing[0].cadence;
      updates.push(Prisma.sql`cadence = ${effectiveCadence}`);
      metadata.cadence = effectiveCadence;
    }
    if (typeof body?.enabled === 'boolean') {
      effectiveEnabled = body.enabled;
      updates.push(Prisma.sql`enabled = ${effectiveEnabled}`);
      metadata.enabled = effectiveEnabled;
    }
    if (body?.notes !== undefined) {
      effectiveNotes = body.notes ? String(body.notes).trim() : null;
      updates.push(Prisma.sql`notes = ${effectiveNotes}`);
      metadata.notes = effectiveNotes;
    }
    if (body?.filters !== undefined) {
      effectiveFilters = typeof body.filters === 'object' ? body.filters : {};
      updates.push(Prisma.sql`filters = ${JSON.stringify(effectiveFilters)}::jsonb`);
      metadata.filters = effectiveFilters;
    }

    await prisma.$executeRaw(Prisma.sql`
      UPDATE scheduled_reports
      SET ${Prisma.join(updates, ', ')}
      WHERE id = ${id}
    `);

    if (body?.runNow) {
      const reportForDelivery: ScheduledReportRecord = {
        id,
        name: effectiveName,
        reportType: effectiveReportType,
        recipientEmail: effectiveRecipientEmail,
        cadence: effectiveCadence,
        enabled: effectiveEnabled,
        filters: effectiveFilters,
        notes: effectiveNotes,
        lastRunAt: existing[0].lastRunAt,
        nextRunAt: existing[0].nextRunAt,
      };

      const delivered = await sendScheduledReportEmail(reportForDelivery);

      if (!delivered) {
        await recordAdminAction({
          action: 'report.delivery_failed',
          req,
          metadata: { reportId: id, reportType: effectiveReportType, recipientEmail: effectiveRecipientEmail },
        });
        return NextResponse.json({ error: 'Failed to deliver scheduled report' }, { status: 502 });
      }

      await prisma.$executeRaw(Prisma.sql`
        UPDATE scheduled_reports
        SET last_run_at = NOW(),
            next_run_at = ${effectiveEnabled ? getNextRunAt(effectiveCadence) : null},
            updated_at = NOW()
        WHERE id = ${id}
      `);

      metadata.runNow = true;
      metadata.delivered = true;
    }

    await recordAdminAction({
      action: body?.runNow ? 'report.sent' : 'report.updated',
      req,
      metadata: { reportId: id, ...metadata },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Scheduled report update error:', error);
    return NextResponse.json({ error: 'Failed to update scheduled report' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const { id } = await params;
    await prisma.$executeRaw(Prisma.sql`DELETE FROM scheduled_reports WHERE id = ${id}`);
    await recordAdminAction({
      action: 'report.deleted',
      req,
      metadata: { reportId: id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Scheduled report delete error:', error);
    return NextResponse.json({ error: 'Failed to delete scheduled report' }, { status: 500 });
  }
}
