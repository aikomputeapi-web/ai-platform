import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    requestsPerDay: 20,
    requestsPerMinute: 5,
    requestsPerMonth: 50,
    limit5hTokens: 150000,
    limitWeekTokens: 500000,
    limitMonthTokens: 1500000,
    allowedModels: '*',
    stripePriceId: null,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceCents: 500,
    requestsPerDay: 300,
    requestsPerMinute: 30,
    requestsPerMonth: 6300,
    limit5hTokens: 3000000,
    limitWeekTokens: 10000000,
    limitMonthTokens: 30000000,
    allowedModels: '*',
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO || null,
  },
  {
    id: 'max-5x',
    name: 'Max 5x',
    priceCents: 2000,
    requestsPerDay: 1500,
    requestsPerMinute: 30,
    requestsPerMonth: 31500,
    limit5hTokens: 15000000,
    limitWeekTokens: 50000000,
    limitMonthTokens: 150000000,
    allowedModels: '*',
    stripePriceId: process.env.STRIPE_PRICE_ID_MAX_5X || null,
  },
  {
    id: 'max-20x',
    name: 'Max 20x',
    priceCents: 4000,
    requestsPerDay: 6000,
    requestsPerMinute: 60,
    requestsPerMonth: 126000,
    limit5hTokens: 60000000,
    limitWeekTokens: 200000000,
    limitMonthTokens: 600000000,
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
