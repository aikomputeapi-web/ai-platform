# Stripe Integration - Quick Start Guide

## 🚀 5-Minute Setup

Your AI platform already has Stripe fully integrated! Just follow these steps to activate it.

## Prerequisites

- Stripe account ([sign up here](https://dashboard.stripe.com/register))
- Running AI platform instance
- Database access

## Setup Steps

### 1. Get Stripe API Keys (2 minutes)

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **API keys**
3. Copy your keys:
   - **Secret key** (starts with `sk_test_` or `sk_live_`)
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)

### 2. Add Keys to Environment (1 minute)

Add to your `.env` file:

```bash
STRIPE_SECRET_KEY=sk_test_51xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # We'll get this in step 4
```

Restart your application after adding the keys.

### 3. Create Products & Prices (2 minutes)

**Option A: Automated Setup (Recommended)**

```bash
cd customer-portal
node scripts/setup-stripe.mjs
```

Follow the prompts to automatically create products and update your database.

**Option B: Manual Setup**

1. Go to [Stripe Products](https://dashboard.stripe.com/products)
2. Create a product for each plan (Pro, Business, Enterprise)
3. Set recurring monthly pricing
4. Copy each Price ID (starts with `price_`)
5. Update your database:

```sql
UPDATE plans SET stripe_price_id = 'price_XXX' WHERE id = 'pro';
UPDATE plans SET stripe_price_id = 'price_YYY' WHERE id = 'business';
UPDATE plans SET stripe_price_id = 'price_ZZZ' WHERE id = 'enterprise';
```

### 4. Set Up Webhooks (1 minute)

**For Development:**

```bash
# Install Stripe CLI if you haven't
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login and forward webhooks
stripe login
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret (starts with `whsec_`) and add it to your `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

**For Production:**

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the signing secret to your `.env`

## ✅ Test It

1. Start your server: `npm run dev`
2. Log in to your customer portal
3. Go to **Dashboard** → **Billing**
4. Click **Upgrade** on any paid plan
5. Use test card: `4242 4242 4242 4242`
6. Complete checkout
7. Verify your plan was upgraded!

## 🧪 Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | Requires authentication |

Use any future expiry date, any 3-digit CVC, and any postal code.

## 📊 What's Already Implemented

✅ **Checkout Flow**
- Stripe Checkout integration
- Automatic customer creation
- Subscription management

✅ **Webhook Handling**
- Payment success/failure tracking
- Automatic plan upgrades/downgrades
- API key limit synchronization

✅ **Customer Portal**
- Manage subscriptions
- Update payment methods
- View billing history

✅ **Database Integration**
- Stripe customer ID storage
- Payment tracking
- Plan management

## 🔍 Verify Integration

Check these to ensure everything is working:

1. **Environment Variables Set**
   ```bash
   echo $STRIPE_SECRET_KEY
   echo $STRIPE_WEBHOOK_SECRET
   ```

2. **Database Updated**
   ```sql
   SELECT id, name, stripe_price_id FROM plans WHERE id != 'free';
   ```

3. **Webhook Receiving Events**
   - Check Stripe Dashboard → Developers → Webhooks
   - Look for successful deliveries

4. **Test Payment Completes**
   - User plan updates in database
   - API key limits sync with OmniRoute
   - Payment record created

## 🐛 Common Issues

### "Stripe not configured yet" Error

**Solution:** Add `STRIPE_SECRET_KEY` to your `.env` file and restart the server.

### Webhook Not Working

**Solution:** 
- Development: Make sure `stripe listen` is running
- Production: Verify webhook URL is publicly accessible
- Check `STRIPE_WEBHOOK_SECRET` is set correctly

### Plan Not Updating After Payment

**Solution:**
- Check webhook logs in Stripe Dashboard
- Verify `stripePriceId` is set in database
- Check application logs for errors

## 📚 Full Documentation

For detailed information, see [`STRIPE_INTEGRATION.md`](./STRIPE_INTEGRATION.md)

## 🔐 Security Notes

- Never commit `.env` files to git
- Use test keys (`sk_test_`) for development
- Use live keys (`sk_live_`) only in production
- Webhooks are verified with signing secrets
- All checkout sessions require authentication

## 🎯 Next Steps

After setup:

1. **Customize Branding**
   - Go to Stripe Dashboard → Settings → Branding
   - Upload logo and set colors

2. **Configure Emails**
   - Go to Settings → Emails
   - Customize receipt and invoice emails

3. **Enable Fraud Prevention**
   - Go to Radar → Rules
   - Review and enable fraud rules

4. **Set Up Tax Collection** (if needed)
   - Go to Settings → Tax
   - Configure tax rates

5. **Monitor Payments**
   - Dashboard → Payments
   - Set up email alerts for failed payments

## 💡 Tips

- Test thoroughly in test mode before going live
- Monitor webhook delivery in Stripe Dashboard
- Set up alerts for failed payments
- Review Stripe logs regularly
- Keep Stripe libraries updated

## 🆘 Need Help?

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)
- Check application logs for errors
- Review webhook event logs in Stripe Dashboard
