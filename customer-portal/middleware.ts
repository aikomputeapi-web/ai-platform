import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminSession } from './src/lib/admin-session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');

  // Only apply auth logic to admin pages and admin API routes
  if (isAdminPage || isAdminApi) {
    // Allow access to login page and auth API endpoints without a session
    if (
      pathname === '/admin/login' ||
      pathname.startsWith('/api/admin/auth/')
    ) {
      return NextResponse.next();
    }

    // Check for admin session cookie
    const sessionToken = request.cookies.get('admin_session')?.value;

    if (!sessionToken) {
      // For API routes, return 401 instead of redirecting
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Redirect UI routes to admin login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify session token
    const isValid = await verifyAdminSession(sessionToken);

    if (!isValid) {
      // For API routes, return 401 instead of redirecting
      if (isAdminApi) {
        const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        response.cookies.delete('admin_session');
        return response;
      }
      // Invalid session — redirect UI to login and clear cookie
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
