import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        console.log('Attempting to dynamically import prisma...');
        const prismaModule = await import('../../../lib/prisma');
        console.log('Prisma module imported.');

        const prisma = prismaModule.prisma;
        console.log('Prisma instance retrieved.');

        const { SERVICES_CONFIG } = await import('../../lib/cacheStore');
        console.log('SERVICES_CONFIG imported:', SERVICES_CONFIG.length);

        const cachedServices = await prisma.service_cache.findMany({
            where: { address: 'pierce.eth' },
        });
        console.log('DB findMany result:', cachedServices.length);

        return res.status(200).json({
            status: 'ok',
            message: 'Prisma imported and connected successfully',
            count: cachedServices.length,
            servicesConfigLength: SERVICES_CONFIG.length,
            env: {
                DATABASE_URL_SET: !!process.env.DATABASE_URL,
                POSTGRES_PRISMA_URL_SET: !!process.env.POSTGRES_PRISMA_URL,
            }
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Debug Prisma Error:', err);
        return res.status(200).json({
            status: 'error',
            message: err.message,
            name: err.name,
            stack: err.stack,
            env: {
                DATABASE_URL_SET: !!process.env.DATABASE_URL,
                POSTGRES_PRISMA_URL_SET: !!process.env.POSTGRES_PRISMA_URL,
            }
        });
    }
}
