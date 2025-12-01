import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        console.log('Attempting to dynamically import prisma...');
        const prismaModule = await import('../../../lib/prisma');
        console.log('Prisma module imported.');

        const prisma = prismaModule.prisma;
        console.log('Prisma instance retrieved.');

        const count = await prisma.service_cache.count();
        console.log('DB count:', count);

        return res.status(200).json({
            status: 'ok',
            message: 'Prisma imported and connected successfully',
            count,
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
