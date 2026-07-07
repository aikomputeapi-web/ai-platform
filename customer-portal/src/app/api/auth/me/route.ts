import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();

  // Try NextAuth session first (for OAuth users)
  const session = await getServerSession(authOptions);

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { plan: true, apiKeys: true },
    });

    if (user && !user.isLocked) {
      return NextResponse.json({
        authenticated: true,
        impersonating: false,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isLocked: false,
          plan: user.plan,
          apiKeys: user.apiKeys.length,
        },
      });
    }
  }

  // Fallback to legacy session (for email/password users)
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const account = user as typeof user & { isLocked?: boolean };
  return NextResponse.json({
    authenticated: true,
    impersonating: !!cookieStore.get('portal_impersonation_session')?.value,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isLocked: account.isLocked || false,
      plan: user.plan,
      apiKeys: user.apiKeys.length,
    },
  });
}
