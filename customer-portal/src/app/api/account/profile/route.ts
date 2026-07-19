import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const name = (body as { name?: unknown })?.name;
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'Name must be a string' }, { status: 400 });
    }
    // Whitespace-only names are truthy and would defeat every `name || fallback`
    // downstream (dashboard greeting, billing customerName) — store null instead.
    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or less' }, { status: 400 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { name: trimmedName || null } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Profile update error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
