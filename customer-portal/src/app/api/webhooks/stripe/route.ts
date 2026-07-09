import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/db';
import { updateKeyLimits } from '@/lib/omniroute';

export const dynamic = 'force-dynamic';

/**
 * Map a plan row to the OmniRoute key-limit payload. A limit of 0 on the plan
 * means "unlimited", which OmniRoute expects as null; '*' allowedModels means
 * "all models", which OmniRoute expects as an empty array. Used by both the
 * upgrade (checkout.session.completed) and downgrade (customer.subscription.deleted)
 * paths so the two can't drift apart.
 */
function planKeyLimits(plan: {
  requestsPerDay: number;
  requestsPerMinute: number;
  requestsPerMonth?: number;
  allowedModels: string;
}) {
  const monthly = plan.requestsPerMonth ?? 0;
  return {
    maxRequestsPerDay: plan.requestsPerDay > 0 ? plan.requestsPerDay : null,
    maxRequestsPerMinute: plan.requestsPerMinute > 0 ? plan.requestsPerMinute : null,
    maxRequestsPerMonth: monthly > 0 ? monthly : null,
    allowedModels: plan.allowedModels === '*' ? [] : JSON.parse(plan.allowedModels),
  };
}

async function processWebhookEvent(event: any) {
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Find user by Stripe customer ID
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!user) {
          console.warn(`[Webhook] User with customer ID ${customerId} not found`);
          break;
        }

        // Determine plan from line items
        const lineItems = await stripe().checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        
        const plan = await prisma.plan.findFirst({
          where: { stripePriceId: priceId },
        });
        if (!plan) {
          console.warn(`[Webhook] Plan with price ID ${priceId} not found`);
          break;
        }

        // Update user plan and store subscription ID
        await prisma.user.update({
          where: { id: user.id },
          data: {
            planId: plan.id,
            stripeSubscriptionId: subscriptionId,
          },
        });

        // Update all user's API keys with new limits
        const userKeys = await prisma.userApiKey.findMany({
          where: { userId: user.id },
        });

        for (const key of userKeys) {
          await updateKeyLimits(key.omnirouteKeyId, planKeyLimits(plan));
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

        await prisma.$executeRaw`
          INSERT INTO billing_adjustments (id, user_id, type, amount_cents, reason, status, actor, created_at)
          VALUES (${crypto.randomUUID()}, ${user.id}, 'charge', ${session.amount_total || 0}, ${`Stripe checkout session ${session.id}`}, 'applied', 'stripe', NOW())
        `;

        console.log(`[Webhook] User ${user.email} upgraded to ${plan.name}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer as string;

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!user) {
          console.warn(`[Webhook] User with customer ID ${customerId} not found`);
          break;
        }

        // Downgrade to free and clear subscription ID
        await prisma.user.update({
          where: { id: user.id },
          data: {
            planId: 'free',
            stripeSubscriptionId: null,
          },
        });

        await prisma.$executeRaw`
          INSERT INTO billing_adjustments (id, user_id, type, amount_cents, reason, status, actor, created_at)
          VALUES (${crypto.randomUUID()}, ${user.id}, 'subscription_canceled', 0, ${`Stripe subscription ${sub.id} ended`}, 'applied', 'stripe', NOW())
        `;

        // Reset API key limits (including the model allowlist) to the free tier
        const freePlan = await prisma.plan.findUnique({ where: { id: 'free' } });
        if (!freePlan) {
          console.error(`[Webhook] Free plan record not found — key limits for ${user.email} left unchanged`);
          break;
        }
        const userKeys = await prisma.userApiKey.findMany({ where: { userId: user.id } });

        for (const key of userKeys) {
          await updateKeyLimits(key.omnirouteKeyId, planKeyLimits(freePlan));
        }

        console.log(`[Webhook] User ${user.email} downgraded to Free`);
        break;
      }
    }
  } catch (error) {
    console.error('[Webhook Processor Error] failed to process stripe webhook event:', error);
  }
}

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
  } catch {
    console.error('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Process event in the background to return 200 OK immediately and avoid timeouts
  processWebhookEvent(event).catch((err) => {
    console.error('[Webhook Async Handler Error]', err);
  });

  return NextResponse.json({ received: true });
}
