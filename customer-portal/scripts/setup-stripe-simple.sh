#!/bin/bash

# Stripe Setup Helper Script for AI Platform
# Plans: Pro ($5), Max 5x ($20), Max 20x ($40)

echo "🔵 Stripe Database Setup for AI Platform"
echo ""
echo "Your plans:"
echo "  - Pro: $5/month"
echo "  - Max 5x: $20/month"
echo "  - Max 20x: $40/month"
echo ""
echo "First, create your products in Stripe Dashboard:"
echo "1. Go to https://dashboard.stripe.com/products"
echo "2. Create three products with these details:"
echo ""
echo "   Product 1: Pro Plan"
echo "   - Price: $5.00 USD"
echo "   - Billing: Monthly recurring"
echo "   - Copy the Price ID (starts with 'price_')"
echo ""
echo "   Product 2: Max 5x Plan"
echo "   - Price: $20.00 USD"
echo "   - Billing: Monthly recurring"
echo "   - Copy the Price ID"
echo ""
echo "   Product 3: Max 20x Plan"
echo "   - Price: $40.00 USD"
echo "   - Billing: Monthly recurring"
echo "   - Copy the Price ID"
echo ""
read -p "Press Enter when you have your Price IDs ready..."
echo ""

# Get database credentials from .env
source ~/ai-platform/.env

# Pro Plan ($5)
echo "Enter Stripe Price ID for Pro Plan - $5/month (price_XXX):"
read PRO_PRICE_ID

# Max 5x Plan ($25)
echo "Enter Stripe Price ID for Max 5x Plan - $25/month (price_XXX):"
read MAX5X_PRICE_ID

# Max 20x Plan ($50)
echo "Enter Stripe Price ID for Max 20x Plan - $50/month (price_XXX):"
read MAX20X_PRICE_ID

echo ""
echo "Updating database..."

# Update database
docker exec -i ai-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB <<EOF
UPDATE plans SET stripe_price_id = '$PRO_PRICE_ID' WHERE id = 'pro';
UPDATE plans SET stripe_price_id = '$MAX5X_PRICE_ID' WHERE id = 'max-5x';
UPDATE plans SET stripe_price_id = '$MAX20X_PRICE_ID' WHERE id = 'max-20x';

-- Show results
SELECT id, name, price_cents/100.0 as price_usd, stripe_price_id FROM plans WHERE id IN ('pro', 'max-5x', 'max-20x') ORDER BY price_cents;
EOF

echo ""
echo "✅ Database updated successfully!"
echo ""
echo "Next steps:"
echo "1. Add your Stripe keys to ~/ai-platform/.env:"
echo "   STRIPE_SECRET_KEY=sk_live_your_key"
echo "   STRIPE_WEBHOOK_SECRET=whsec_your_secret"
echo ""
echo "2. Set up webhook endpoint:"
echo "   stripe listen --forward-to https://yourdomain.com/api/webhooks/stripe"
echo "   (Copy the webhook secret to .env)"
echo ""
echo "3. Restart the application:"
echo "   cd ~/ai-platform && ./manage.sh restart"
echo ""
echo "4. Test at: https://yourdomain.com/dashboard/billing"
echo "   Use test card: 4242 4242 4242 4242"
