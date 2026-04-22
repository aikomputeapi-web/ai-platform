import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function makePrismaClient(): PrismaClient {
  // Prisma 7 reads connection URL from prisma.config.ts at runtime
  // We must NOT create the client at build time (no DB available)
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    // During build, return a proxy that defers initialization
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        if (prop === 'then') return undefined; // Not a promise
        throw new Error(`PrismaClient accessed during build (property: ${String(prop)}). This should not happen.`);
      },
    });
  }
  return new PrismaClient();
}

export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = makePrismaClient();
  }
  return globalForPrisma.prisma;
}

// Default export for convenience — uses a getter to defer creation
const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (prop === 'then') return undefined;
    const client = getDb();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default prisma;
