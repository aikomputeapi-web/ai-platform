import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { cancelSubscription } from '@/lib/stripe';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE /api/billing/subscription — cancel the user's Stripe subscription
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    
    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
    }

    // Get the user's subscription ID from the database
    const userWithSubscription = user as typeof user & { stripeSubscriptionId: string | null };
    const subscriptionId = userWithSubscription.stripeSubscriptionId;
    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Cancel the subscription in Stripe
    await cancelSubscription(subscriptionId);

    // Update the user's plan to free in the database
    const freePlan = await prisma.plan.findUnique({ where: { id: 'free' } });
    if (freePlan) {
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          planId: freePlan.id,
          stripeSubscriptionId: null,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Subscription canceled successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}