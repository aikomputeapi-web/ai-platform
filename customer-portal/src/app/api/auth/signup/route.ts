import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, createSessionToken, generateVerifyToken } from '@/lib/auth';
import { sendVerificationEmail, sendWelcomeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Check existing
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Ensure free plan exists
    await prisma.plan.upsert({
      where: { id: 'free' },
      update: {},
      create: {
        id: 'free',
        name: 'Free',
        priceCents: 0,
        requestsPerDay: 100,
        requestsPerMinute: 5,
        allowedModels: '*',
        sortOrder: 0,
      },
    });

    const passwordHash = await hashPassword(password);
    const verifyToken = generateVerifyToken();

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        verifyToken,
        planId: 'free',
      },
    });

    const hasEmailProvider = !!process.env.RESEND_API_KEY;

    if (hasEmailProvider) {
      // Production: send verification email, don't log in yet
      await sendVerificationEmail(user.email, verifyToken);
      return NextResponse.json({
        success: true,
        requiresVerification: true,
        message: 'Check your email to verify your account.',
      });
    } else {
      // Dev mode: auto-verify and log in
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, verifyToken: null },
      });
    }

    const token = await createSessionToken(user.id);
    // Fire welcome email async — don't block signup
    sendWelcomeEmail(user.email, name || undefined).catch(() => {});

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
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
