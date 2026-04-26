import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/db';
import { updateKeyLimits } from '@/lib/omniroute';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = session.customer as string;

      // Find user by Stripe customer ID
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) break;

      // Determine plan from line items
      const lineItems = await stripe().checkout.sessions.listLineItems(session.id);
      const priceId = lineItems.data[0]?.price?.id;
      
      const plan = await prisma.plan.findFirst({
        where: { stripePriceId: priceId },
      });
      if (!plan) break;

      // Update user plan
      await prisma.user.update({
        where: { id: user.id },
        data: { planId: plan.id },
      });

      // Update all user's API keys with new limits
      const userKeys = await prisma.userApiKey.findMany({
        where: { userId: user.id },
      });

      for (const key of userKeys) {
        const isFree = plan.id === 'free';
        await updateKeyLimits(key.omnirouteKeyId, {
          maxRequestsPerDay: isFree ? null : plan.requestsPerDay,
          maxRequestsPerMinute: plan.requestsPerMinute,
          maxRequestsPerMonth: isFree ? plan.requestsPerMonth : null,
          allowedModels: plan.allowedModels === '*' ? [] : JSON.parse(plan.allowedModels),
        });
      }

      // Record payment
      await prisma.payment.create({
        data: {
          userId: user.id,
          stripePaymentId: session.payment_intent as string,
          amountCents: session.amount_total || 0,
          planId: plan.id,
          status: 'completed',
        },
      });

      console.log(`[Webhook] User ${user.email} upgraded to ${plan.name}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const customerId = sub.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) break;

      // Downgrade to free
      await prisma.user.update({
        where: { id: user.id },
        data: { planId: 'free' },
      });

      // Reset API key limits to free tier
      const freePlan = await prisma.plan.findUnique({ where: { id: 'free' } });
      const userKeys = await prisma.userApiKey.findMany({ where: { userId: user.id } });

      for (const key of userKeys) {
        const isFree = true;
        await updateKeyLimits(key.omnirouteKeyId, {
          maxRequestsPerDay: null,
          maxRequestsPerMinute: freePlan?.requestsPerMinute || 5,
          maxRequestsPerMonth: freePlan?.requestsPerMonth || 50,
        });
      }

      console.log(`[Webhook] User ${user.email} downgraded to Free`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
