import Stripe from 'stripe';
import prisma from '@/lib/db';

export async function recordTopUp(session: Stripe.Checkout.Session, expectedUserId?: string) {
  if (session.mode !== 'payment' || session.payment_status !== 'paid') {
    throw new Error('Payment is not complete');
  }
  const userId = session.client_reference_id;
  const amountCents = Number(session.metadata?.amountCents);
  if (!userId || (expectedUserId && expectedUserId !== userId)) throw new Error('Payment does not belong to this account');
  if (session.metadata?.purpose !== 'account_credit' || session.metadata?.userId !== userId) throw new Error('Invalid payment metadata');
  if (!Number.isInteger(amountCents) || amountCents < 500 || amountCents > 50000 || session.amount_total !== amountCents || session.currency !== 'usd') {
    throw new Error('Payment amount could not be verified');
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId || user.stripeCustomerId !== session.customer) throw new Error('Payment customer could not be verified');

  try {
    await prisma.billingAdjustment.create({
      data: {
        userId,
        type: 'account_credit',
        amountCents,
        reason: `Account credit top-up (${session.id})`,
        actor: 'stripe',
        stripeReference: session.id,
      },
    });
  } catch (error) {
    // Stripe may deliver a webhook and the return-page confirmation together.
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const existing = await prisma.billingAdjustment.findUnique({ where: { stripeReference: session.id } });
    if (!existing || existing.userId !== userId || existing.amountCents !== amountCents || existing.type !== 'account_credit') throw error;
  }
}
