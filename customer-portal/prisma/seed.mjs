import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    requestsPerDay: 100,
    requestsPerMinute: 5,
    requestsPerMonth: 50,
    limit5hTokens: 150000,
    limitWeekTokens: 500000,
    limitMonthTokens: 1500000,
    allowedModels: '*',
    stripePriceId: null,
  },
  {
    id: 'basic',
    name: 'Basic',
    priceCents: 1900,
    requestsPerDay: 1000,
    requestsPerMinute: 20,
    requestsPerMonth: 0,
    limit5hTokens: 600000,
    limitWeekTokens: 2000000,
    limitMonthTokens: 6000000,
    allowedModels: '*',
    stripePriceId: null,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceCents: 500,
    requestsPerDay: 3000,
    requestsPerMinute: 60,
    requestsPerMonth: 300000,
    limit5hTokens: 1500000,
    limitWeekTokens: 5000000,
    limitMonthTokens: 15000000,
    allowedModels: '*',
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO || null,
  },
  {
    id: 'max-5x',
    name: 'Max 5x',
    priceCents: 2000,
    requestsPerDay: 6000,
    requestsPerMinute: 150,
    requestsPerMonth: 600000,
    limit5hTokens: 7500000,
    limitWeekTokens: 25000000,
    limitMonthTokens: 75000000,
    allowedModels: '*',
    stripePriceId: process.env.STRIPE_PRICE_ID_MAX_5X || null,
  },
  {
    id: 'max-20x',
    name: 'Max 20x',
    priceCents: 4000,
    requestsPerDay: 12000,
    requestsPerMinute: 300,
    requestsPerMonth: 1200000,
    limit5hTokens: 30000000,
    limitWeekTokens: 100000000,
    limitMonthTokens: 300000000,
    allowedModels: '*',
    stripePriceId: process.env.STRIPE_PRICE_ID_MAX_20X || null,
  },
];

async function main() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        priceCents: plan.priceCents,
        requestsPerDay: plan.requestsPerDay,
        requestsPerMinute: plan.requestsPerMinute,
        requestsPerMonth: plan.requestsPerMonth,
        limit5hTokens: plan.limit5hTokens,
        limitWeekTokens: plan.limitWeekTokens,
        limitMonthTokens: plan.limitMonthTokens,
        allowedModels: plan.allowedModels,
        stripePriceId: plan.stripePriceId,
      },
      create: plan,
    });
  }

  console.log(`Seeded ${plans.length} plans.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
