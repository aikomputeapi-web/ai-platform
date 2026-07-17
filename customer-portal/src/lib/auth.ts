import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import prisma from './db';
import { getServerSession } from 'next-auth';
import { authOptions } from './nextauth';
import { hashPassword, verifyPassword } from './password';

export { hashPassword, verifyPassword };

const TOKEN_EXPIRY = '30d';

// Resolved lazily (not at module load) so a missing env var fails at first
// use in production instead of silently signing sessions with a public
// default, and so builds without runtime env vars still succeed.
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn('[auth] WARNING: JWT_SECRET is not set. Using insecure default — set this env var before deploying.');
    return new TextEncoder().encode('dev-secret-change-me');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  // Resolve the secret outside the try so a production misconfiguration
  // surfaces as an error rather than being swallowed as "invalid token".
  const secret = getJwtSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  // Try NextAuth session first (for OAuth users)
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { plan: true, apiKeys: true },
    });

    if (user && !user.isLocked) {
      return user;
    }
  }

  // Fallback to legacy session (for email/password users)
  const cookieStore = await cookies();
  const token = cookieStore.get('portal_impersonation_session')?.value || cookieStore.get('portal_session')?.value;
  if (!token) return null;

  const sessionTokenObj = await verifySessionToken(token);
  if (!sessionTokenObj) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionTokenObj.userId },
    include: { plan: true, apiKeys: true },
  });

  if (!user || user.isLocked) {
    return null;
  }

  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export function generateVerifyToken(): string {
  // 36 random bytes -> 48 base64url chars, matching the historical token length.
  return randomBytes(36).toString('base64url');
}
