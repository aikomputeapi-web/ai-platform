#!/usr/bin/env node

/**
 * Stripe Setup Script
 * 
 * This script helps you configure Stripe integration by:
 * 1. Validating your Stripe API keys
 * 2. Creating products and prices in Stripe
 * 3. Updating your database with Stripe Price IDs
 * 
 * Usage:
 *   node scripts/setup-stripe.mjs
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🔵 Stripe Integration Setup\n');
  console.log('This script will help you set up Stripe for your AI platform.\n');

  // Step 1: Get API Key
  const apiKey = await question('Enter your Stripe Secret Key (sk_test_... or sk_live_...): ');
  
  if (!apiKey || (!apiKey.startsWith('sk_test_') && !apiKey.startsWith('sk_live_'))) {
    console.error('❌ Invalid Stripe API key. Must start with sk_test_ or sk_live_');
    process.exit(1);
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: '2026-04-22.dahlia',
  });

  // Validate API key
  console.log('\n✓ Validating API key...');
  try {
    await stripe.balance.retrieve();
    console.log('✓ API key is valid!\n');
  } catch (error) {
    console.error('❌ Invalid API key:', error.message);
    process.exit(1);
  }

  // Step 2: Check existing plans
  console.log('📋 Fetching existing plans from database...\n');
  const plans = await prisma.plan.findMany({
    where: {
      id: { not: 'free' }
    },
    orderBy: { sortOrder: 'asc' }
  });

  if (plans.length === 0) {
    console.log('❌ No paid plans found in database. Please create plans first.');
    process.exit(1);
  }

  console.log(`Found ${plans.length} paid plan(s):\n`);
  plans.forEach(plan => {
    console.log(`  - ${plan.name} ($${(plan.priceCents / 100).toFixed(2)}/month)`);
    if (plan.stripePriceId) {
      console.log(`    Current Stripe Price ID: ${plan.stripePriceId}`);
    }
  });

  // Step 3: Ask what to do
  console.log('\nWhat would you like to do?');
  console.log('1. Create new Stripe products and prices');
  console.log('2. Use existing Stripe price IDs');
  console.log('3. Exit');
  
  const choice = await question('\nEnter your choice (1-3): ');

  if (choice === '3') {
    console.log('Exiting...');
    process.exit(0);
  }

  if (choice === '1') {
    // Create products and prices
    console.log('\n🔨 Creating Stripe products and prices...\n');
    
    for (const plan of plans) {
      console.log(`Creating product for ${plan.name}...`);
      
      try {
        // Create product
        const product = await stripe.products.create({
          name: plan.name,
          description: `${plan.name} - ${plan.requestsPerMonth.toLocaleString()} requests/month`,
        });
        
        console.log(`✓ Created product: ${product.id}`);
        
        // Create price
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.priceCents,
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
        });
        
        console.log(`✓ Created price: ${price.id}`);
        
        // Update database
        await prisma.plan.update({
          where: { id: plan.id },
          data: { stripePriceId: price.id }
        });
        
        console.log(`✓ Updated database for ${plan.name}\n`);
      } catch (error) {
        console.error(`❌ Error creating ${plan.name}:`, error.message);
      }
    }
    
    console.log('✅ All products and prices created successfully!\n');
  } else if (choice === '2') {
    // Use existing price IDs
    console.log('\n📝 Enter existing Stripe Price IDs\n');
    
    for (const plan of plans) {
      const priceId = await question(`Enter Stripe Price ID for ${plan.name} (price_...): `);
      
      if (!priceId || !priceId.startsWith('price_')) {
        console.log(`⚠️  Skipping ${plan.name} - invalid price ID`);
        continue;
      }
      
      try {
        // Verify price exists
        await stripe.prices.retrieve(priceId);
        
        // Update database
        await prisma.plan.update({
          where: { id: plan.id },
          data: { stripePriceId: priceId }
        });
        
        console.log(`✓ Updated ${plan.name} with price ${priceId}`);
      } catch (error) {
        console.error(`❌ Error with ${plan.name}:`, error.message);
      }
    }
    
    console.log('\n✅ Price IDs updated successfully!\n');
  }

  // Step 4: Show next steps
  console.log('📋 Next Steps:\n');
  console.log('1. Add your Stripe keys to .env file:');
  console.log(`   STRIPE_SECRET_KEY=${apiKey}`);
  console.log('   STRIPE_WEBHOOK_SECRET=whsec_...\n');
  
  console.log('2. Set up webhook endpoint:');
  console.log('   Development: stripe listen --forward-to http://localhost:3000/api/webhooks/stripe');
  console.log('   Production: Add webhook in Stripe Dashboard\n');
  
  console.log('3. Test the integration:');
  console.log('   - Start your dev server: npm run dev');
  console.log('   - Go to /dashboard/billing');
  console.log('   - Try upgrading to a paid plan\n');
  
  console.log('📚 For more details, see: docs/STRIPE_INTEGRATION.md\n');

  rl.close();
  await prisma.$disconnect();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
