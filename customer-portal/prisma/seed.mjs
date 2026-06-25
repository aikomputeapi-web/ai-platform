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
    priceCents: 2000,
    requestsPerDay: 0,
    requestsPerMinute: 0,
    requestsPerMonth: 0,
    limit5hTokens: 2000000,
    limitWeekTokens: 8000000,
    limitMonthTokens: 25000000,
    allowedModels: '*',
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO || null,
  },
  {
    id: 'max-5x',
    name: 'Max 5x',
    priceCents: 10000,
    requestsPerDay: 0,
    requestsPerMinute: 0,
    requestsPerMonth: 0,
    limit5hTokens: 10000000,
    limitWeekTokens: 40000000,
    limitMonthTokens: 125000000,
    allowedModels: '*',
    stripePriceId: process.env.STRIPE_PRICE_ID_MAX_5X || null,
  },
  {
    id: 'max-20x',
    name: 'Max 20x',
    priceCents: 20000,
    requestsPerDay: 0,
    requestsPerMinute: 0,
    requestsPerMonth: 0,
    limit5hTokens: 40000000,
    limitWeekTokens: 160000000,
    limitMonthTokens: 500000000,
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
