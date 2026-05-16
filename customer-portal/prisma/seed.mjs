import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    id: 'pro',
    name: 'Pro',
    priceCents: 500,
    requestsPerDay: 3000,
    requestsPerMinute: 60,
    requestsPerMonth: 300000,
    allowedModels: '*',
    stripePriceId: null,
  },
  {
    id: 'max-5x',
    name: 'Max 5x',
    priceCents: 2500,
    requestsPerDay: 6000,
    requestsPerMinute: 150,
    requestsPerMonth: 600000,
    allowedModels: '*',
    stripePriceId: null,
  },
  {
    id: 'max-20x',
    name: 'Max 20x',
    priceCents: 5000,
    requestsPerDay: 12000,
    requestsPerMinute: 300,
    requestsPerMonth: 1200000,
    allowedModels: '*',
    stripePriceId: null,
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
