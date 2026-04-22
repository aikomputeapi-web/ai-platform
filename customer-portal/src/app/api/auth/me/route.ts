import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      apiKeys: user.apiKeys.length,
    },
  });
}
