import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

interface SupportTicketRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  internalNotes: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const status = req.nextUrl.searchParams.get('status');
    const priority = req.nextUrl.searchParams.get('priority');
    const search = (req.nextUrl.searchParams.get('search') || '').trim();

    const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];
    if (status && status !== 'all') {
      conditions.push(Prisma.sql`t.status = ${status}`);
    }
    if (priority && priority !== 'all') {
      conditions.push(Prisma.sql`t.priority = ${priority}`);
    }
    if (search) {
      const like = `%${search}%`;
      conditions.push(Prisma.sql`
        (
          t.subject ILIKE ${like}
          OR t.description ILIKE ${like}
          OR t.status ILIKE ${like}
          OR t.priority ILIKE ${like}
          OR u.email ILIKE ${like}
        )
      `);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    const tickets = await prisma.$queryRaw<SupportTicketRow[]>(Prisma.sql`
      SELECT
        t.id,
        t.user_id AS "userId",
        u.email AS "userEmail",
        u.name AS "userName",
        t.subject,
        t.description,
        t.status,
        t.priority,
        t.assigned_to AS "assignedTo",
        t.internal_notes AS "internalNotes",
        t.source,
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM support_tickets t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE ${whereClause}
      ORDER BY
        CASE t.status WHEN 'open' THEN 0 WHEN 'triaged' THEN 1 WHEN 'waiting' THEN 2 WHEN 'closed' THEN 3 ELSE 4 END,
        CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
        t.created_at DESC
      LIMIT 100
    `);

    const counts = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT status, COUNT(*)::bigint AS count
      FROM support_tickets
      GROUP BY status
    `);

    return NextResponse.json({
      tickets: tickets.map((ticket) => ({
        ...ticket,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      })),
      summary: {
        open: Number(counts.find((entry) => entry.status === 'open')?.count || 0),
        triaged: Number(counts.find((entry) => entry.status === 'triaged')?.count || 0),
        waiting: Number(counts.find((entry) => entry.status === 'waiting')?.count || 0),
        closed: Number(counts.find((entry) => entry.status === 'closed')?.count || 0),
      },
    });
  } catch (error) {
    console.error('Support ticket fetch error:', error);
    return NextResponse.json({ error: 'Failed to load support tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const body = await req.json();
    const userId = body?.userId ? String(body.userId) : null;
    const userEmail = body?.userEmail ? String(body.userEmail).trim() : '';
    const subject = String(body?.subject || '').trim();
    const description = String(body?.description || '').trim();
    const internalNotes = body?.notes ? String(body.notes).trim() : body?.internalNotes ? String(body.internalNotes).trim() : '';
    const priority = ['low', 'normal', 'high', 'critical'].includes(String(body?.priority || 'normal'))
      ? String(body?.priority || 'normal')
      : 'normal';

    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    let resolvedUserId = userId;
    let resolvedEmail = userEmail || null;
    let resolvedName: string | null = null;

    if (resolvedUserId) {
      const user = await prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { id: true, email: true, name: true },
      });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      resolvedEmail = user.email;
      resolvedName = user.name;
    } else if (resolvedEmail) {
      const user = await prisma.user.findUnique({
        where: { email: resolvedEmail },
        select: { id: true, email: true, name: true },
      });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      resolvedUserId = user.id;
      resolvedEmail = user.email;
      resolvedName = user.name;
    } else {
      return NextResponse.json({ error: 'userId or userEmail is required' }, { status: 400 });
    }

    const id = randomUUID();
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO support_tickets (id, user_id, subject, description, status, priority, assigned_to, internal_notes, source, created_at, updated_at)
      VALUES (${id}, ${resolvedUserId}, ${subject}, ${description}, 'open', ${priority}, NULL, ${internalNotes || null}, 'manual', NOW(), NOW())
    `);

    await recordAdminAction({
      action: 'support.ticket_created',
      req,
      targetUserId: resolvedUserId,
      targetUserEmail: resolvedEmail,
      metadata: { subject, priority },
    });

    return NextResponse.json({
      success: true,
      ticket: {
        id,
        userId: resolvedUserId,
        userEmail: resolvedEmail,
        userName: resolvedName,
        subject,
        description,
        status: 'open',
        priority,
        assignedTo: null,
        internalNotes: internalNotes || null,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Support ticket create error:', error);
    return NextResponse.json({ error: 'Failed to create support ticket' }, { status: 500 });
  }
}
