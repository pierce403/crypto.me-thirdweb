import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const dbUrl = process.env.DATABASE_URL;
        const maskedUrl = dbUrl ? `${dbUrl.substring(0, 15)}...` : 'NOT_SET';

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
                DATABASE_URL_PREFIX: maskedUrl,
                NODE_ENV: process.env.NODE_ENV,
                VERCEL_ENV: process.env.VERCEL_ENV,
            }
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return res.status(500).json({
            status: 'error',
            message: err.message,
            name: err.name,
            stack: err.stack,
            env: {
                DATABASE_URL_SET: !!process.env.DATABASE_URL,
            }
        });
    }
}
