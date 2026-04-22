import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid or already-used verification link' }, { status: 400 });
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
