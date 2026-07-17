import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, setAdminSessionCookie } from '@/lib/admin-session';
import { createFailureLimiter } from '@/lib/cooldown';

// There is a single shared admin password, so the failed-attempt limiter is
// keyed globally rather than per account — see lib/cooldown.ts for caveats.
// Anyone can trip it and temporarily block this form (existing admin session
// cookies keep working), which beats unlimited guessing of the one secret.
const adminLoginFailures = createFailureLimiter(15 * 60 * 1000, 10);
const LIMITER_KEY = 'admin-login';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const { password } = body ?? {};

    if (typeof password !== 'string' || !password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (adminLoginFailures.isBlocked(LIMITER_KEY)) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Verify admin password
    if (!verifyAdminPassword(password)) {
      adminLoginFailures.recordFailure(LIMITER_KEY);
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }
    adminLoginFailures.reset(LIMITER_KEY);

    // Create session and set cookie
    const response = NextResponse.json({ success: true });
    await setAdminSessionCookie(response);

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
