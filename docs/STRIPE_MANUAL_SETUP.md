# Stripe Setup - Manual Steps (No Node.js Required)

Since Node.js isn't installed on your host system, follow these manual steps to set up Stripe.

## Step 1: Get Your Stripe API Keys

1. Go to [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register) and create an account
2. Once logged in, go to **Developers** → **API keys**
3. Copy these two keys:
   - **Secret key** (starts with `sk_test_` for test mode)
   - **Publishable key** (starts with `pk_test_` for test mode)

## Step 2: Add Keys to Environment File

Edit your `.env` file in the `ai-platform` directory:

```bash
cd ~/ai-platform
nano .env
```

Add these lines (replace with your actual keys):

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

Save and exit (Ctrl+X, then Y, then Enter)

## Step 3: Create Stripe Products and Prices

### Option A: Using Stripe Dashboard (Easiest)

1. Go to [https://dashboard.stripe.com/products](https://dashboard.stripe.com/products)
2. Click **Add product**

**For Pro Plan:**
- Name: `Pro Plan`
- Description: `Professional tier with enhanced limits`
- Pricing model: **Recurring**
- Price: `$29.00`
- Billing period: **Monthly**
- Click **Save product**
- **Copy the Price ID** (starts with `price_`) - you'll need this

**For Business Plan:**
- Name: `Business Plan`
- Description: `Business tier with advanced features`
- Pricing model: **Recurring**
- Price: `$99.00`
- Billing period: **Monthly**
- Click **Save product**
- **Copy the Price ID**

**For Enterprise Plan:**
- Name: `Enterprise Plan`
- Description: `Enterprise tier with maximum limits`
- Pricing model: **Recurring**
- Price: `$299.00`
- Billing period: **Monthly**
- Click **Save product**
- **Copy the Price ID**

### Option B: Using Stripe CLI

If you have Stripe CLI installed:

```bash
# Install Stripe CLI first
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Create Pro Plan
stripe products create --name="Pro Plan" --description="Professional tier"
# Note the product ID (prod_XXX)

stripe prices create \
  --product=prod_XXX \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month
# Copy the price ID (price_XXX)

# Repeat for Business and Enterprise plans
```

## Step 4: Update Database with Price IDs

Connect to your database and update the plans:

```bash
# Access PostgreSQL in Docker
docker exec -it postgres psql -U aiplatform -d aiplatform
```

Then run these SQL commands (replace `price_XXX` with your actual Price IDs):

```sql
-- Update Pro plan
UPDATE plans 
SET stripe_price_id = 'price_XXX_your_pro_price_id' 
WHERE id = 'pro';

-- Update Business plan
UPDATE plans 
SET stripe_price_id = 'price_YYY_your_business_price_id' 
WHERE id = 'business';

-- Update Enterprise plan
UPDATE plans 
SET stripe_price_id = 'price_ZZZ_your_enterprise_price_id' 
WHERE id = 'enterprise';

-- Verify the updates
SELECT id, name, stripe_price_id FROM plans;

-- Exit
\q
```

## Step 5: Set Up Webhook Secret

### For Development:

1. Install Stripe CLI (if not already installed):
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Linux
   wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
   tar -xvf stripe_linux_x86_64.tar.gz
   sudo mv stripe /usr/local/bin/
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to https://yourdomain.com/api/webhooks/stripe
   ```
   
   Replace `yourdomain.com` with your actual domain (e.g., `aiapi.indevs.in`)

4. Copy the webhook secret that appears (starts with `whsec_`)

5. Add it to your `.env` file:
   ```bash
   nano ~/ai-platform/.env
   ```
   
   Update the line:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_the_secret_from_stripe_listen
   ```

### For Production:

1. Go to [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter: `https://yourdomain.com/api/webhooks/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Click **Reveal** in the Signing secret section
7. Copy the secret and update your `.env` file

## Step 6: Restart Your Application

```bash
cd ~/ai-platform
./manage.sh restart
```

Or restart just the customer portal:

```bash
docker restart customer-portal
```

## Step 7: Test the Integration

1. Go to your customer portal: `https://yourdomain.com`
2. Log in or create an account
3. Go to **Dashboard** → **Billing**
4. Click **Upgrade** on the Pro plan
5. You should be redirected to Stripe Checkout

**Test Card Numbers:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires 3DS: `4000 0025 0000 3155`

Use any future expiry date, any 3-digit CVC, and any postal code.

## Verification Checklist

- [ ] Stripe API keys added to `.env`
- [ ] Created 3 products in Stripe (Pro, Business, Enterprise)
- [ ] Copied all 3 Price IDs
- [ ] Updated database with Price IDs
- [ ] Set up webhook endpoint
- [ ] Added webhook secret to `.env`
- [ ] Restarted application
- [ ] Tested checkout with test card
- [ ] Verified plan upgrade in database
- [ ] Checked webhook delivery in Stripe Dashboard

## Quick Database Check

To verify your setup:

```bash
# Check if Price IDs are set
docker exec -it postgres psql -U aiplatform -d aiplatform -c "SELECT id, name, stripe_price_id FROM plans;"

# Check if Stripe keys are loaded (in container)
docker exec customer-portal printenv | grep STRIPE
```

## Troubleshooting

### "Stripe not configured yet" Error
- Make sure `STRIPE_SECRET_KEY` is in your `.env` file
- Restart the customer-portal container: `docker restart customer-portal`

### Webhook Not Working
- Make sure `stripe listen` is running (for development)
- Check webhook secret is correct in `.env`
- Verify webhook URL is accessible from internet

### Plan Not Updating After Payment
- Check Stripe Dashboard → Webhooks for delivery status
- Check application logs: `docker logs customer-portal`
- Verify Price IDs are correct in database

## Summary

You've manually configured Stripe by:
1. ✅ Adding API keys to environment
2. ✅ Creating products and prices in Stripe
3. ✅ Updating database with Price IDs
4. ✅ Setting up webhook endpoint
5. ✅ Testing the integration

Your Stripe integration is now ready to accept payments!

## Next Steps

- Switch to live mode when ready for production
- Customize Stripe branding in Dashboard
- Set up email notifications
- Enable fraud prevention (Stripe Radar)
- Configure tax collection if needed

For more details, see:
- [STRIPE_QUICKSTART.md](./STRIPE_QUICKSTART.md)
- [STRIPE_INTEGRATION.md](./STRIPE_INTEGRATION.md)
- [STRIPE_WEBHOOK_SETUP.md](./STRIPE_WEBHOOK_SETUP.md)
