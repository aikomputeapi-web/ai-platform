import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { token } = body ?? {};
    // The string guard is load-bearing: Prisma also accepts filter objects
    // here, so a JSON body like {"token":{"not":null}} would otherwise match
    // an arbitrary user's pending token and issue a session for that account.
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid or already-used verification link' }, { status: 400 });
    }

    // Login and reset-password refuse locked accounts; the verify flow must
    // not hand out a session for one either. Checked after token validation
    // so lock status is only revealed to whoever controls the inbox.
    if (user.isLocked) {
      return NextResponse.json({ error: 'Account locked. Contact support.' }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null },
    });

    const sessionToken = await createSessionToken(user.id);
    const response = NextResponse.json({ success: true });
    response.cookies.set('portal_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (err) {
    console.error('Verify email error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
