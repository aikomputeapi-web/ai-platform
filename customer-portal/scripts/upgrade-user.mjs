import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const email = process.argv[2] || 'ii301xxx@gmail.com';
const planId = process.argv[3] || 'max-20x';

async function main() {
  console.log(`Upgrading user ${email} to plan ${planId}...`);
  
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exitCode = 1;
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId }
  });

  if (!plan) {
    console.error(`Plan ${planId} not found. Available plans: free, pay-as-you-go, pro, max-5x, max-20x`);
    process.exitCode = 1;
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { planId },
    include: { plan: true }
  });

  console.log("Successfully updated user plan!");
  console.log(JSON.stringify(updatedUser, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
