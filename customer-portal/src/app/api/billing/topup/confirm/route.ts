import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { recordTopUp } from '@/lib/account-credit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const sessionId = (await req.json().catch(() => null))?.sessionId;
    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) return NextResponse.json({ error: 'Invalid checkout session' }, { status: 400 });
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    await recordTopUp(session, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error instanceof Error && error.message === 'Payment is not complete') return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Top-up confirmation failed:', error);
    return NextResponse.json({ error: 'Could not confirm payment' }, { status: 500 });
  }
}
