# How to Get Your Stripe Webhook Secret

The webhook secret is used to verify that webhook events are actually coming from Stripe and not from an attacker. Here's how to get it:

---

## 🔧 Development Environment (Local Testing)

### Step 1: Install Stripe CLI

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
tar -xvf stripe_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Windows:**
Download from [https://github.com/stripe/stripe-cli/releases](https://github.com/stripe/stripe-cli/releases)

### Step 2: Login to Stripe

```bash
stripe login
```

This will open your browser to authenticate with Stripe.

### Step 3: Forward Webhooks to Your Local Server

```bash
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

You'll see output like this:

```
> Ready! Your webhook signing secret is whsec_1234567890abcdefghijklmnopqrstuvwxyz (^C to quit)
```

### Step 4: Copy the Webhook Secret

Copy the secret that starts with `whsec_` and add it to your `.env` file:

```bash
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz
```

### Step 5: Keep It Running

Keep the `stripe listen` command running in a terminal while you develop. Every webhook event from Stripe will be forwarded to your local server.

---

## 🚀 Production Environment

### Step 1: Go to Stripe Dashboard

1. Log in to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure you're in **Live mode** (toggle in top right)
3. Go to **Developers** → **Webhooks**

### Step 2: Add Webhook Endpoint

1. Click **Add endpoint** button
2. Enter your webhook URL:
   ```
   https://yourdomain.com/api/webhooks/stripe
   ```
   Replace `yourdomain.com` with your actual domain

3. Click **Select events**

### Step 3: Select Events to Listen For

Select these events (required for the integration):

- ✅ `checkout.session.completed`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`

Click **Add events**

### Step 4: Add the Endpoint

Click **Add endpoint** to save

### Step 5: Get the Signing Secret

1. You'll see your new webhook endpoint in the list
2. Click on it to view details
3. In the **Signing secret** section, click **Reveal**
4. Copy the secret (starts with `whsec_`)

### Step 6: Add to Production Environment

Add the secret to your production `.env` file:

```bash
STRIPE_WEBHOOK_SECRET=whsec_production_secret_here
```

**Important:** The webhook secret is different for each endpoint, so your development and production secrets will be different.

---

## 🔍 Verify It's Working

### Test in Development

1. Make sure `stripe listen` is running
2. In another terminal, trigger a test event:
   ```bash
   stripe trigger checkout.session.completed
   ```
3. Check your application logs - you should see the webhook being processed

### Test in Production

1. Go to your billing page: `https://yourdomain.com/dashboard/billing`
2. Click **Upgrade** on a plan
3. Complete a test payment (use test card `4242 4242 4242 4242`)
4. Go to Stripe Dashboard → **Developers** → **Webhooks**
5. Click on your endpoint
6. You should see successful webhook deliveries in the **Attempts** section

---

## 🐛 Troubleshooting

### "No webhook secret found" Error

**Problem:** `STRIPE_WEBHOOK_SECRET` is not set in your environment

**Solution:**
1. Check your `.env` file has the webhook secret
2. Restart your application after adding it
3. Verify with: `echo $STRIPE_WEBHOOK_SECRET`

### Webhook Signature Verification Failed

**Problem:** The webhook secret doesn't match

**Solutions:**
- Make sure you copied the entire secret including `whsec_`
- Check for extra spaces or line breaks
- Verify you're using the correct secret for your environment (test vs live)
- If using Stripe CLI, make sure it's still running

### Webhooks Not Being Received

**Development:**
- Make sure `stripe listen` is running
- Check the forward URL matches your local server
- Verify your server is running on the correct port

**Production:**
- Verify your webhook URL is publicly accessible
- Check your server logs for incoming requests
- Go to Stripe Dashboard → Webhooks → Click your endpoint → Check "Attempts" tab for errors
- Make sure your server accepts POST requests to `/api/webhooks/stripe`

### "Webhook endpoint must be HTTPS" Error

**Problem:** Production webhooks require HTTPS

**Solution:**
- Make sure your domain has SSL/TLS configured
- Use Let's Encrypt (automatic with the platform's setup script)
- For testing, use `stripe listen` which works with HTTP

---

## 📋 Quick Reference

| Environment | How to Get Secret | Secret Format |
|-------------|-------------------|---------------|
| **Development** | `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe` | `whsec_test_...` |
| **Production** | Stripe Dashboard → Developers → Webhooks → Add endpoint | `whsec_...` |

---

## 🔐 Security Notes

- **Never commit webhook secrets to git** - they're in `.env` which should be in `.gitignore`
- **Use different secrets for test and live mode** - Stripe provides separate secrets
- **Rotate secrets if compromised** - you can generate new ones in the Stripe Dashboard
- **Verify signatures** - the integration already does this automatically
- **Use HTTPS in production** - required by Stripe for security

---

## 📚 Additional Resources

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)

---

## ✅ Checklist

- [ ] Stripe CLI installed (development)
- [ ] Ran `stripe login`
- [ ] Ran `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe`
- [ ] Copied webhook secret to `.env`
- [ ] Restarted application
- [ ] Tested with `stripe trigger checkout.session.completed`
- [ ] Verified webhook processing in logs
- [ ] (Production) Added webhook endpoint in Stripe Dashboard
- [ ] (Production) Selected required events
- [ ] (Production) Copied production webhook secret
- [ ] (Production) Tested with real payment

---

**Need Help?** Check the [Stripe Integration Guide](./STRIPE_INTEGRATION.md) for more details.
