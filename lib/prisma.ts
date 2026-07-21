import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function getLocalConnectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NO_SSL
  );
}

function getRuntimeConnectionString(): string {
  try {
    const connectionString = getCloudflareContext().env.HYPERDRIVE?.connectionString;
    if (connectionString) return connectionString;
  } catch {
    // `next dev`, tests, and the Prisma CLI do not always have a Workers context.
  }

  const localConnectionString = getLocalConnectionString();
  if (!localConnectionString) {
    throw new Error('No database connection is configured');
  }

  return localConnectionString;
}

export function createPrisma(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    // Hyperdrive owns cross-request pooling. A connection must not be reused by
    // a different Workers request context.
    maxUses: 1,
  });

  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  return createPrisma(getRuntimeConnectionString());
}

export async function withPrisma<T>(work: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = getPrisma();
  try {
    return await work(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
