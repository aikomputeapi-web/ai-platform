import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateVerifyToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { recordAdminAction } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// Per-email cooldown so this endpoint can't be used to flood an inbox.
// In-memory, so it's per-instance and resets on deploy — acceptable for a
// courtesy resend; it is not a security boundary.
const RESEND_COOLDOWN_MS = 60 * 1000;
const lastRequestAt = new Map<string, number>();

function underCooldown(email: string): boolean {
  const now = Date.now();
  if (lastRequestAt.size > 1000) {
    for (const [key, at] of lastRequestAt) {
      if (now - at >= RESEND_COOLDOWN_MS) lastRequestAt.delete(key);
    }
  }
  const last = lastRequestAt.get(email);
  if (last !== undefined && now - last < RESEND_COOLDOWN_MS) return true;
  lastRequestAt.set(email, now);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { email } = (body ?? {}) as { email?: unknown };
    if (typeof email !== 'string' || !email || email.length > 254) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const normalized = email.toLowerCase();

    // Every path below returns the same generic success so the response never
    // reveals whether the account exists or is verified (same policy as
    // forgot-password). The cooldown is applied before any lookup for the
    // same reason.
    if (underCooldown(normalized)) {
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || user.emailVerified) {
      return NextResponse.json({ success: true });
    }

    // Always rotate rather than reuse user.verifyToken — same reasoning as
    // the admin resend: old tokens may predate the crypto.randomBytes fix,
    // and rotation invalidates any previously emailed link.
    const verifyToken = generateVerifyToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken },
    });

    const sent = await sendVerificationEmail(user.email, verifyToken);
    if (!sent) {
      // Still generic success: failures are logged by lib/email, and the
      // user can simply retry after the cooldown.
      console.error(`[resend-verification] send failed for user ${user.id}`);
      return NextResponse.json({ success: true });
    }

    await recordAdminAction({
      action: 'user.verification_resent',
      actor: user.email,
      targetUserId: user.id,
      targetUserEmail: user.email,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Resend verification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
