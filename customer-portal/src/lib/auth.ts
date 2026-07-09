import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import prisma from './db';
import { getServerSession } from 'next-auth';
import { authOptions } from './nextauth';
import { hashPassword, verifyPassword } from './password';

export { hashPassword, verifyPassword };

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');
const TOKEN_EXPIRY = '30d';

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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

    const account = user as typeof user & { isLocked?: boolean };
    if (account && !account.isLocked) {
      return account;
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

  const account = user as typeof user & { isLocked?: boolean };
  if (!account || account.isLocked) {
    return null;
  }

  return account;
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
