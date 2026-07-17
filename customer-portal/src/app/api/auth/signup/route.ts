import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { hashPassword, createSessionToken, generateVerifyToken } from '@/lib/auth';
import { sendVerificationEmail, sendWelcomeEmail } from '@/lib/email';
import { recordAdminAction } from '@/lib/admin';

async function isEmailDotShadowbanEnabled(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ value: unknown }>>(
    Prisma.sql`SELECT value FROM admin_settings WHERE key = 'email_dot_shadowban' LIMIT 1`
  );
  const row = rows[0];
  if (!row || typeof row.value !== 'object' || row.value === null || Array.isArray(row.value)) return false;
  return (row.value as Record<string, unknown>).enabled === true;
}

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { email, password, name } = ((body ?? {}) as Record<string, unknown>) as {
      email?: unknown;
      password?: unknown;
      name?: unknown;
    };

    if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (name !== undefined && name !== null && typeof name !== 'string') {
      return NextResponse.json({ error: 'Name must be a string' }, { status: 400 });
    }
    if (typeof name === 'string' && name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or less' }, { status: 400 });
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
        requestsPerDay: 0,
        requestsPerMinute: 5,
        requestsPerMonth: 50,
        allowedModels: '*',
        sortOrder: 0,
      },
    });

    const passwordHash = await hashPassword(password);
    const verifyToken = generateVerifyToken();

    const parts = email.split('@');
    const username = parts[0] || '';
    const domain = parts[1] || '';
    const dotCount = (username.match(/\./g) || []).length;

    const isShadowLocked = false;
    let isShadowBanned = false;
    let adminNote = null;

    // Only apply auto-shadowban if the rule is enabled in admin settings (default: off)
    const dotRuleEnabled = await isEmailDotShadowbanEnabled();
    const isGmail = domain.toLowerCase() === 'gmail.com' || domain.toLowerCase() === 'googlemail.com';
    if (dotRuleEnabled && isGmail && dotCount >= 4) {
      isShadowBanned = true;
      adminNote = `Automatically shadow banned: Gmail account with ${dotCount} dots in email local part.`;
    }

    // The findUnique check above races with concurrent signups for the same
    // email — the loser hits the unique constraint on users.email, which must
    // surface as 409 (like the pre-check), not a generic 500.
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name: name || null,
          verifyToken,
          planId: 'free',
          isShadowLocked,
          isShadowBanned,
          adminNote,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
      }
      throw err;
    }

    await recordAdminAction({
      action: 'user.signed_up',
      actor: user.email,
      targetUserId: user.id,
      targetUserEmail: user.email,
    });

    const hasEmailProvider = !!process.env.RESEND_API_KEY;

    if (hasEmailProvider) {
      // Production: send verification email, don't log in yet
      const sent = await sendVerificationEmail(user.email, verifyToken);
      if (!sent) {
        // The account exists but can't be verified (and since login requires
        // verification, can't be used) until the email goes out. Don't claim
        // "check your email" — tell the user delivery failed. There is no
        // self-serve resend yet, so support is the only recovery path.
        return NextResponse.json(
          {
            error:
              'Your account was created, but we could not send the verification email. Please contact support to get a new verification link.',
          },
          { status: 502 }
        );
      }
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
