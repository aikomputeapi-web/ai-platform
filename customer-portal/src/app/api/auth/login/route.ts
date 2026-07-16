import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword, createSessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { email, password } = body ?? {};

    if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.isLocked) {
      return NextResponse.json({ error: 'Account locked. Contact support.' }, { status: 403 });
    }

    // OAuth users don't have passwords - they should use OAuth sign-in
    if (!user.passwordHash) {
      return NextResponse.json({ error: 'Please sign in with your OAuth provider (Google, GitHub, or Apple)' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Signup withholds the session until the email is verified (only when an
    // email provider is configured — same carve-out as signup's dev mode).
    // Without this gate, logging in right after signup bypasses verification.
    // Checked after password validation so unverified status is only revealed
    // to someone who already has valid credentials.
    if (!user.emailVerified && process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: 'Please verify your email before signing in. Check your inbox for the verification link.',
          requiresVerification: true,
        },
        { status: 403 }
      );
    }

    const token = await createSessionToken(user.id);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set('portal_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
