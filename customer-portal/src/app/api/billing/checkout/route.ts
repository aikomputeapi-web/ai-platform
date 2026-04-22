import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createCheckoutSession, createPortalSession, createStripeCustomer } from '@/lib/stripe';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';
// POST /api/billing/checkout — create a Stripe checkout session
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { planId } = await req.json();

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Create Stripe customer if needed
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await createStripeCustomer(user.email, user.name || undefined);
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await createCheckoutSession(
      stripeCustomerId,
      plan.stripePriceId,
      `${baseUrl}/dashboard/billing?success=true`,
      `${baseUrl}/dashboard/billing?canceled=true`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}

// GET /api/billing/portal — redirect to Stripe billing portal
export async function GET() {
  try {
    const user = await requireAuth();
    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await createPortalSession(
      user.stripeCustomerId,
      `${baseUrl}/dashboard/billing`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
