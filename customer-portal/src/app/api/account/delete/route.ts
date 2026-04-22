import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { deleteOmniRouteKey } from '@/lib/omniroute';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    const user = await requireAuth();

    // Revoke all OmniRoute keys
    const keys = await prisma.userApiKey.findMany({ where: { userId: user.id } });
    await Promise.allSettled(keys.map(k => deleteOmniRouteKey(k.omnirouteKeyId)));

    // Delete user and cascade (keys, payments deleted via FK cascade)
    await prisma.user.delete({ where: { id: user.id } });

    const response = NextResponse.json({ success: true });
    response.cookies.set('portal_session', '', { httpOnly: true, path: '/', maxAge: 0 });
    return response;
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
