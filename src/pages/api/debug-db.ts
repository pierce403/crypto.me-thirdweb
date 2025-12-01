import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const dbUrl = process.env.DATABASE_URL;
        const pgUrl = process.env.POSTGRES_PRISMA_URL;

        const startTime = Date.now();
        const count = await prisma.service_cache.count();
        const duration = Date.now() - startTime;

        return res.status(200).json({
            status: 'ok',
            message: 'Database connection successful',
            count,
            duration: `${duration}ms`,
            env: {
                DATABASE_URL_SET: !!dbUrl,
                POSTGRES_PRISMA_URL_SET: !!pgUrl,
                NODE_ENV: process.env.NODE_ENV,
            }
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return res.status(500).json({
            status: 'error',
            message: err.message,
            name: err.name,
            env: {
                DATABASE_URL_SET: !!process.env.DATABASE_URL,
                POSTGRES_PRISMA_URL_SET: !!process.env.POSTGRES_PRISMA_URL,
            }
        });
    }
}
