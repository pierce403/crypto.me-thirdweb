import { PrismaClient } from '@prisma/client';

// Vercel Postgres exposes `POSTGRES_PRISMA_URL` / `POSTGRES_URL*` by default.
// Prisma expects the schema datasource env var to exist at runtime, so we alias it.
if (!process.env.DATABASE_URL) {
  const fallback =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL_NO_SSL;
  if (fallback) process.env.DATABASE_URL = fallback;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // optional: log: ['query', 'error', 'warn']
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
