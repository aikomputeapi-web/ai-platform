import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("--- SEARCHING FOR KEY ENDING IN 32fd ---");
  const key = await prisma.userApiKey.findFirst({
    where: {
      lastFour: '32fd'
    },
    include: {
      user: {
        include: {
          plan: true
        }
      }
    }
  });
  console.log("Key:", JSON.stringify(key, null, 2));

  console.log("--- SEARCHING FOR USER WITH EMAIL CONTAINING ii301 ---");
  const user = await prisma.user.findFirst({
    where: {
      email: {
        contains: 'ii301'
      }
    },
    include: {
      plan: true,
      apiKeys: true
    }
  });
  console.log("User:", JSON.stringify(user, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
