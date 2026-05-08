import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!verifyAdminAccess(req)) {
    return adminForbidden();
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const status = String(body?.status || '').trim();
    const priority = String(body?.priority || '').trim();
    const assignedTo = body?.assignedTo === null ? null : body?.assignedTo ? String(body.assignedTo).trim() : undefined;
    const internalNotes = body?.internalNotes === null ? null : body?.internalNotes ? String(body.internalNotes).trim() : undefined;

    const ticket = await prisma.$queryRaw<Array<{
      id: string;
      userId: string | null;
      userEmail: string | null;
      userName: string | null;
      subject: string;
      internalNotes: string | null;
    }>>(Prisma.sql`
      SELECT t.id, t.user_id AS "userId", u.email AS "userEmail", u.name AS "userName", t.subject, t.internal_notes AS "internalNotes"
      FROM support_tickets t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ${id}
      LIMIT 1
    `);

    if (!ticket.length) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const updates: Prisma.Sql[] = [Prisma.sql`updated_at = NOW()`];
    const metadata: Record<string, unknown> = {};

    if (status) {
      updates.push(Prisma.sql`status = ${status}`);
      metadata.status = status;
    }
    if (priority) {
      updates.push(Prisma.sql`priority = ${priority}`);
      metadata.priority = priority;
    }
    if (assignedTo !== undefined) {
      updates.push(Prisma.sql`assigned_to = ${assignedTo}`);
      metadata.assignedTo = assignedTo;
    }
    if (internalNotes !== undefined) {
      updates.push(Prisma.sql`internal_notes = ${internalNotes}`);
      metadata.internalNotes = internalNotes;
    }

    await prisma.$executeRaw(Prisma.sql`
      UPDATE support_tickets
      SET ${Prisma.join(updates, ', ')}
      WHERE id = ${id}
    `);

    await recordAdminAction({
      action: 'support.ticket_updated',
      req,
      targetUserId: ticket[0].userId,
      targetUserEmail: ticket[0].userEmail,
      metadata: { ticketId: id, subject: ticket[0].subject, ...metadata },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Support ticket update error:', error);
    return NextResponse.json({ error: 'Failed to update support ticket' }, { status: 500 });
  }
}
