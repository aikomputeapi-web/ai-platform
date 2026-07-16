import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateVerifyToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Per-email cooldown so this endpoint can't be used to flood an inbox or
// burn through the email-send quota. In-memory, so it's per-instance and
// resets on deploy — a courtesy limit, not a security boundary.
const RESET_COOLDOWN_MS = 60 * 1000;
const lastRequestAt = new Map<string, number>();

function underCooldown(email: string): boolean {
  const now = Date.now();
  if (lastRequestAt.size > 1000) {
    for (const [key, at] of lastRequestAt) {
      if (now - at >= RESET_COOLDOWN_MS) lastRequestAt.delete(key);
    }
  }
  const last = lastRequestAt.get(email);
  if (last !== undefined && now - last < RESET_COOLDOWN_MS) return true;
  lastRequestAt.set(email, now);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { email } = body ?? {};
    if (typeof email !== 'string' || !email || email.length > 254) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const normalized = email.toLowerCase();

    // Applied before the lookup and answered with the same generic success,
    // so the cooldown itself can't be used for user enumeration.
    if (underCooldown(normalized)) {
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({ where: { email: normalized } });

    // Always respond with success to avoid user enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    const token = generateVerifyToken();
    const exp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExp: exp },
    });

    await sendPasswordResetEmail(user.email, token);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
