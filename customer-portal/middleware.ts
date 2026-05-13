import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminSession } from './src/lib/admin-session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if accessing admin routes (except login and auth endpoints)
  if (pathname.startsWith('/admin')) {
    // Allow access to login page and auth API endpoints
    if (
      pathname === '/admin/login' ||
      pathname.startsWith('/admin/auth/') ||
      pathname.startsWith('/api/admin/auth/')
    ) {
      return NextResponse.next();
    }

    // Check for admin session cookie
    const sessionToken = request.cookies.get('admin_session')?.value;

    if (!sessionToken) {
      // Redirect to admin login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify session token
    const isValid = await verifyAdminSession(sessionToken);

    if (!isValid) {
      // Invalid session, redirect to login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('admin_session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};
