import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'admin_session';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Get JWT secret from environment
function getJwtSecret(): Uint8Array {
  const secret = process.env.PORTAL_JWT_SECRET || process.env.JWT_SECRET || 'change-me-in-production';
  return new TextEncoder().encode(secret);
}

// Admin secret for validation
export function getAdminSecret(): string {
  return process.env.ADMIN_API_SECRET || process.env.OMNIROUTE_INITIAL_PASSWORD || 'admin';
}

// Verify admin password
export function verifyAdminPassword(password: string): boolean {
  return password === getAdminSecret();
}

// Create admin session token
export async function createAdminSession(): Promise<string> {
  const secret = getJwtSecret();
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_DURATION / 1000)
    .sign(secret);
  
  return token;
}

// Verify admin session token
export async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// Set admin session cookie (for API routes)
export async function setAdminSessionCookie(response: NextResponse): Promise<NextResponse> {
  const token = await createAdminSession();
  
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true, // Required for HTTPS in production
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
  
  return response;
}

// Clear admin session cookie
export function clearAdminSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}

// Check if request has valid admin session (for API routes)
export async function hasValidAdminSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifyAdminSession(token);
}

// Get admin session from cookies (for server components)
export async function getAdminSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value || null;
}

// Verify admin session from cookies (for server components)
export async function isAdminAuthenticated(): Promise<boolean> {
  const token = await getAdminSession();
  if (!token) return false;
  return verifyAdminSession(token);
}
