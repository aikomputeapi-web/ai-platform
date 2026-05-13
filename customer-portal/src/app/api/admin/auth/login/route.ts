import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, setAdminSessionCookie } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Verify admin password
    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

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
