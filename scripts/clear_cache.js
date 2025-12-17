
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearCache() {
    console.log('Clearing service cache...');
    try {
        const deleted = await prisma.serviceCache.deleteMany({});
        console.log(`Deleted ${deleted.count} cache entries.`);
    } catch (error) {
        console.error('Error clearing cache:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearCache();
