# Stripe Integration Guide

## Overview

This AI platform has a complete Stripe integration for subscription billing. The integration includes:

- ✅ Stripe checkout sessions for plan upgrades
- ✅ Webhook handling for subscription events
- ✅ Customer portal for subscription management
- ✅ Automatic plan upgrades/downgrades
- ✅ API key limit synchronization with OmniRoute
- ✅ Payment tracking in the database

## Architecture

### Database Schema

The integration uses the following database fields:

**User Model:**
- `stripeCustomerId` - Stores the Stripe customer ID
- `planId` - References the current plan

**Plan Model:**
- `stripePriceId` - Stripe Price ID for the subscription
- `priceCents` - Price in cents for display
- `requestsPerDay`, `requestsPerMinute`, `requestsPerMonth` - Rate limits

**Payment Model:**
- `stripePaymentId` - Stripe payment intent/invoice ID
- `amountCents` - Payment amount
- `status` - Payment status (pending, succeeded, failed)

### Key Files

1. **[`src/lib/stripe.ts`](../customer-portal/src/lib/stripe.ts)** - Stripe client initialization and helper functions
2. **[`src/app/api/billing/checkout/route.ts`](../customer-portal/src/app/api/billing/checkout/route.ts)** - Checkout session creation
3. **[`src/app/api/webhooks/stripe/route.ts`](../customer-portal/src/app/api/webhooks/stripe/route.ts)** - Webhook event handling
4. **[`src/app/dashboard/billing/page.tsx`](../customer-portal/src/app/dashboard/billing/page.tsx)** - Billing UI

## Setup Instructions

### 1. Create a Stripe Account

1. Go to [https://stripe.com](https://stripe.com) and create an account
2. Complete the account verification process
3. Navigate to the Dashboard

### 2. Get Your API Keys

1. Go to **Developers** → **API keys** in the Stripe Dashboard
2. Copy your **Publishable key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)

### 3. Create Products and Prices

You need to create Stripe Products and Prices for each plan:

#### Option A: Using Stripe Dashboard

1. Go to **Products** → **Add product**
2. Create products for each plan (Pro, Business, Enterprise)
3. For each product:
   - Set the name (e.g., "Pro Plan")
   - Set the pricing model to **Recurring**
   - Set the billing period (monthly/yearly)
   - Set the price
   - Click **Save product**
4. Copy the **Price ID** (starts with `price_`) for each product

#### Option B: Using Stripe CLI

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Create Pro Plan
stripe products create \
  --name="Pro Plan" \
  --description="Professional tier with enhanced limits"

stripe prices create \
  --product=prod_XXX \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month

# Create Business Plan
stripe products create \
  --name="Business Plan" \
  --description="Business tier with advanced features"

stripe prices create \
  --product=prod_YYY \
  --unit-amount=9900 \
  --currency=usd \
  --recurring[interval]=month

# Create Enterprise Plan
stripe products create \
  --name="Enterprise Plan" \
  --description="Enterprise tier with maximum limits"

stripe prices create \
  --product=prod_ZZZ \
  --unit-amount=29900 \
  --currency=usd \
  --recurring[interval]=month
```

### 4. Configure Environment Variables

Add the following to your `.env` file in the `customer-portal` directory:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Optional: For client-side Stripe.js (if needed)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### 5. Update Plan Stripe Price IDs

Update the database with your Stripe Price IDs:

```sql
-- Update Pro plan
UPDATE plans 
SET stripe_price_id = 'price_XXX' 
WHERE id = 'pro';

-- Update Business plan
UPDATE plans 
SET stripe_price_id = 'price_YYY' 
WHERE id = 'business';

-- Update Enterprise plan
UPDATE plans 
SET stripe_price_id = 'price_ZZZ' 
WHERE id = 'enterprise';
```

Or use the Prisma client:

```javascript
// In a migration script or seed file
await prisma.plan.update({
  where: { id: 'pro' },
  data: { stripePriceId: 'price_XXX' }
});

await prisma.plan.update({
  where: { id: 'business' },
  data: { stripePriceId: 'price_YYY' }
});

await prisma.plan.update({
  where: { id: 'enterprise' },
  data: { stripePriceId: 'price_ZZZ' }
});
```

### 6. Set Up Webhook Endpoint

#### Option A: Using Stripe CLI (Development)

```bash
# Forward webhooks to your local server
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# Copy the webhook signing secret (starts with whsec_)
# Add it to your .env file as STRIPE_WEBHOOK_SECRET
```

#### Option B: Using Stripe Dashboard (Production)

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Enter your webhook URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

### 7. Test the Integration

#### Test Checkout Flow

1. Start your development server:
   ```bash
   cd customer-portal
   npm run dev
   ```

2. Log in to your customer portal
3. Navigate to the Billing page
4. Click "Upgrade" on a paid plan
5. You should be redirected to Stripe Checkout

#### Test Webhook Events

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

Use any future expiry date, any 3-digit CVC, and any postal code.

#### Verify Webhook Processing

1. Complete a test checkout
2. Check your application logs for webhook events
3. Verify the user's plan was updated in the database
4. Verify the API key limits were updated in OmniRoute

## How It Works

### Checkout Flow

1. User clicks "Upgrade" on the billing page
2. Frontend sends POST request to [`/api/billing/checkout`](../customer-portal/src/app/api/billing/checkout/route.ts)
3. Backend creates or retrieves Stripe customer
4. Backend creates Stripe checkout session
5. User is redirected to Stripe Checkout
6. User completes payment
7. Stripe redirects back to success page

### Webhook Flow

1. Stripe sends webhook event to [`/api/webhooks/stripe`](../customer-portal/src/app/api/webhooks/stripe/route.ts)
2. Webhook handler verifies signature
3. Handler processes event based on type:
   - `checkout.session.completed` - Creates payment record
   - `customer.subscription.created` - Updates user plan
   - `customer.subscription.updated` - Updates user plan
   - `customer.subscription.deleted` - Downgrades to free plan
   - `invoice.payment_succeeded` - Records successful payment
   - `invoice.payment_failed` - Records failed payment
4. Handler updates API key limits in OmniRoute
5. Handler returns success response

### Customer Portal Flow

1. User clicks "Manage Subscription" on billing page
2. Frontend sends POST request to [`/api/billing/checkout`](../customer-portal/src/app/api/billing/checkout/route.ts) with `action: 'portal'`
3. Backend creates Stripe billing portal session
4. User is redirected to Stripe Customer Portal
5. User can update payment method, cancel subscription, etc.
6. Changes trigger webhook events that update the database

## API Endpoints

### POST `/api/billing/checkout`

Creates a Stripe checkout session or portal session.

**Request Body:**
```json
{
  "planId": "pro",
  "action": "checkout" // or "portal"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### POST `/api/webhooks/stripe`

Handles Stripe webhook events.

**Headers:**
- `stripe-signature` - Webhook signature for verification

**Body:** Raw webhook event JSON

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Creates payment record, updates plan if subscription |
| `customer.subscription.created` | Updates user plan, syncs API key limits |
| `customer.subscription.updated` | Updates user plan, syncs API key limits |
| `customer.subscription.deleted` | Downgrades to free plan, syncs API key limits |
| `invoice.payment_succeeded` | Records successful payment |
| `invoice.payment_failed` | Records failed payment, sends notification |

## Security Considerations

1. **Webhook Signature Verification** - All webhooks are verified using the signing secret
2. **Authentication** - Checkout endpoint requires user authentication
3. **Environment Variables** - API keys stored securely in environment variables
4. **HTTPS Required** - Production webhooks must use HTTPS
5. **Idempotency** - Webhook handler checks for duplicate events

## Troubleshooting

### "Stripe not configured yet" Error

- Verify `STRIPE_SECRET_KEY` is set in your environment
- Check that the key starts with `sk_test_` or `sk_live_`
- Restart your development server after adding the key

### Webhook Not Receiving Events

- Verify webhook URL is correct in Stripe Dashboard
- Check that `STRIPE_WEBHOOK_SECRET` is set correctly
- Ensure your server is publicly accessible (use ngrok for local testing)
- Check webhook logs in Stripe Dashboard for errors

### Plan Not Updating After Payment

- Check webhook logs in your application
- Verify the webhook event was received and processed
- Check that `stripePriceId` is set correctly in the database
- Verify OmniRoute connection is working

### Customer Portal Not Working

- Verify Stripe customer ID exists for the user
- Check that billing portal is enabled in Stripe Dashboard
- Ensure user has an active subscription

## Testing in Development

### Using Stripe CLI

```bash
# Listen for webhooks
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

### Using Test Mode

- Use test API keys (starting with `sk_test_` and `pk_test_`)
- Use test card numbers from Stripe documentation
- Test events appear in Stripe Dashboard under "Developers" → "Events"

## Production Checklist

- [ ] Switch to live API keys (`sk_live_`, `pk_live_`)
- [ ] Configure production webhook endpoint in Stripe Dashboard
- [ ] Update `STRIPE_WEBHOOK_SECRET` with production secret
- [ ] Test checkout flow with real payment method
- [ ] Verify webhook events are being received
- [ ] Set up monitoring for failed payments
- [ ] Configure email notifications for payment failures
- [ ] Review Stripe Dashboard settings (branding, emails, etc.)
- [ ] Enable Stripe Radar for fraud prevention
- [ ] Set up tax collection if required

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)
- [Stripe Testing](https://stripe.com/docs/testing)

## Support

For issues with the integration:
1. Check the troubleshooting section above
2. Review Stripe Dashboard logs
3. Check application logs for errors
4. Contact support with specific error messages
