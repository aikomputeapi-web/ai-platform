import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { deleteOmniRouteKey } from '@/lib/omniroute';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    const user = await requireAuth();

    // Revoke all OmniRoute keys. If any revocation fails, abort before
    // deleting the user — the cascade would erase the omnirouteKeyId
    // mappings, leaving live keys on the proxy that nothing can find or
    // revoke later. (deleteOmniRouteKey treats 404 as success.)
    const keys = await prisma.userApiKey.findMany({ where: { userId: user.id } });
    const results = await Promise.allSettled(keys.map(k => deleteOmniRouteKey(k.omnirouteKeyId)));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      for (const f of failures) console.error('Account deletion: failed to revoke OmniRoute key:', f.reason);
      return NextResponse.json(
        { error: 'Failed to revoke API keys. Your account was not deleted — please try again.' },
        { status: 502 }
      );
    }

    // Delete user and cascade (keys, payments deleted via FK cascade)
    await prisma.user.delete({ where: { id: user.id } });

    const response = NextResponse.json({ success: true });
    response.cookies.set('portal_session', '', { httpOnly: true, path: '/', maxAge: 0 });
    return response;
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Account deletion error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
