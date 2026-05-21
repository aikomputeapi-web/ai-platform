import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';

export async function POST() {
  // Check if using NextAuth session
  const session = await getServerSession(authOptions);
  
  const response = NextResponse.json({ success: true });
  
  // Clear legacy session cookie
  response.cookies.set('portal_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  // Clear NextAuth session cookies
  if (session) {
    response.cookies.set('next-auth.session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set('__Secure-next-auth.session-token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}
