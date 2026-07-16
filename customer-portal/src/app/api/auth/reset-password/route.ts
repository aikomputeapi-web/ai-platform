import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, createSessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { token, password } = body ?? {};

    if (typeof token !== 'string' || !token || typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    // Login refuses locked accounts; a locked account must not be able to
    // rotate its password or obtain a session via the reset flow either.
    // Checked after token validation so lock status is only revealed to
    // whoever controls the inbox.
    if (user.isLocked) {
      return NextResponse.json({ error: 'Account locked. Contact support.' }, { status: 403 });
    }

    const passwordHash = await hashPassword(password);
    // Completing the reset link proves control of the inbox — the same proof
    // the verification link provides. Without this, the session issued below
    // would bypass login's email-verification gate for unverified accounts.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExp: null,
        emailVerified: true,
        verifyToken: null,
      },
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
    console.error('Reset password error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
