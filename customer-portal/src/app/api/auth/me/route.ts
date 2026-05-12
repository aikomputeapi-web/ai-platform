import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
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
