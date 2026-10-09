import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/db';
import { createStripeCustomer, stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => null);
    const amountCents = body?.amountCents;
    if (!Number.isInteger(amountCents) || amountCents < 500 || amountCents > 50000) {
      return NextResponse.json({ error: 'Choose an amount from $5 to $500 USD' }, { status: 400 });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await createStripeCustomer(user.email, user.name || undefined);
      const claimed = await prisma.user.updateMany({ where: { id: user.id, stripeCustomerId: null }, data: { stripeCustomerId: customer.id } });
      if (claimed.count) customerId = customer.id;
      else customerId = (await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } }))?.stripeCustomerId ?? null;
    }
    if (!customerId) throw new Error('Stripe customer could not be created');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await stripe().checkout.sessions.create({
      mode: 'payment', customer: customerId, client_reference_id: user.id,
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amountCents, product_data: { name: 'AIKompute account credit', description: 'One-time account credit top-up' } } }],
      metadata: { purpose: 'account_credit', userId: user.id, amountCents: String(amountCents) },
      payment_intent_data: { metadata: { purpose: 'account_credit', userId: user.id, amountCents: String(amountCents) } },
      success_url: `${baseUrl}/dashboard/billing?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/billing?topup=canceled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Top-up checkout creation failed:', error);
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 });
  }
}
