import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY not set');
    }
    _stripe = new Stripe(key, {
      apiVersion: '2026-04-22.dahlia',
    });
  }
  return _stripe;
}

export { getStripe as stripe };

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  return getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function createStripeCustomer(email: string, name?: string) {
  return getStripe().customers.create({
    email,
    name: name || undefined,
  });
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// Cancel a subscription, resolving once it is no longer billing: cancels a
// live subscription, and treats already-terminal ('canceled' /
// 'incomplete_expired') or missing subscriptions as success so callers can
// safely retry. Anything else (auth, network, rate limit) rethrows.
export async function ensureSubscriptionCanceled(subscriptionId: string) {
  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
      await getStripe().subscriptions.cancel(subscriptionId);
    }
  } catch (e) {
    if (e instanceof Stripe.errors.StripeInvalidRequestError && e.code === 'resource_missing') {
      return;
    }
    throw e;
  }
}
