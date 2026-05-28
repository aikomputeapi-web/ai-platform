import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the legacy custom session cookie (email/password login path).
  // NextAuth JWT session cookies are cleared by calling signOut() on the
  // client, which hits /api/auth/signout — do NOT duplicate that here to
  // avoid partial-clear bugs that cause redirect loops.
  response.cookies.set('portal_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  // Also clear impersonation cookie if present
  response.cookies.set('portal_impersonation_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
