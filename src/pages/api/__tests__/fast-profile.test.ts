import { NextApiRequest, NextApiResponse } from 'next';
import { createMocks, createRequest, createResponse } from 'node-mocks-http';
import handler from '../fast-profile'; // Adjust path if needed
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    service_cache: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    // Mock other models if needed by the tests
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

// Mock fetch for service calls
global.fetch = jest.fn();

let prisma: PrismaClient;

beforeEach(() => {
  prisma = new PrismaClient();
  // Reset mocks before each test
  jest.clearAllMocks();
  (global.fetch as jest.Mock).mockClear();
});

describe('/api/fast-profile handler', () => {
  const mockAddress = '0x123';
  const servicesConfig = [ // Simplified version of what's in fast-profile.ts
    { name: 'ens', defaultData: { name: null } },
    { name: 'farcaster', defaultData: null },
  ];

  test('should return 400 if address is missing', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: {},
    });
    await handler(req as NextApiRequest, res as NextApiResponse);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toBe('Address is required');
  });

  test('should return data from DB cache if fresh', async () => {
    const now = new Date();
    const futureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    (prisma.service_cache.findMany as jest.Mock).mockResolvedValue([
      { service: 'ens', data: JSON.stringify({ name: 'test.eth' }), last_updated: now, expires_at: futureExpiry },
      { service: 'farcaster', data: JSON.stringify({ username: 'testuser' }), last_updated: now, expires_at: futureExpiry },
    ]);

    const { req, res } = createMocks({ method: 'GET', query: { address: mockAddress } });
    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.source).toBe('database-cache');
    expect(responseData.services.ens.name).toBe('test.eth');
    expect(responseData.services.farcaster.username).toBe('testuser');
    expect(prisma.service_cache.findMany).toHaveBeenCalledWith({ where: { address: mockAddress.toLowerCase() } });
    expect(global.fetch).not.toHaveBeenCalled(); // No background fetch
  });

  test('should return partial data and trigger background fetch if data is stale', async () => {
    const pastExpiry = new Date(Date.now() - 1000); // Expired
    (prisma.service_cache.findMany as jest.Mock).mockResolvedValue([
      { service: 'ens', data: JSON.stringify({ name: 'stale.eth' }), last_updated: new Date(pastExpiry.getTime() - 24 * 60 * 60 * 1000) , expires_at: pastExpiry },
    ]);
    // Mock successful background fetch for 'farcaster'
    (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ // Mock for ENS service
            ok: true,
            json: async () => ({ name: 'fresh.ens.eth' }),
        })
        .mockResolvedValueOnce({ // Mock for Farcaster service
            ok: true,
            json: async () => ({ username: 'freshuser' }),
        });

    (prisma.service_cache.upsert as jest.Mock).mockResolvedValue({});


    const { req, res } = createMocks({ method: 'GET', query: { address: mockAddress } });
    await handler(req as NextApiRequest, res as NextApiResponse); // Main handler returns quickly

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.source).toBe('database-partial-cache'); // Or 'initial' if no services were fresh
    expect(responseData.services.ens.name).toBe('stale.eth');

    // Allow background fetch to complete
    await new Promise(process.nextTick); // Wait for async operations

    expect(global.fetch).toHaveBeenCalledTimes(servicesConfig.length); // Called for all services
    expect(prisma.service_cache.upsert).toHaveBeenCalledTimes(servicesConfig.length);
     // Example check for one upsert
    expect(prisma.service_cache.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { address_service: { address: mockAddress.toLowerCase(), service: 'farcaster' } },
        create: expect.objectContaining({ data: JSON.stringify({ username: 'freshuser' }) }),
        update: expect.objectContaining({ data: JSON.stringify({ username: 'freshuser' }) }),
    }));
  });

  test('should handle missing service data and trigger background fetch', async () => {
    (prisma.service_cache.findMany as jest.Mock).mockResolvedValue([]); // No data in cache
    (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ someData: 'fetched' })
    });
    (prisma.service_cache.upsert as jest.Mock).mockResolvedValue({});

    const { req, res } = createMocks({ method: 'GET', query: { address: mockAddress } });
    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.source).toBe('initial'); // No data initially

    await new Promise(process.nextTick); // Wait for async operations
    expect(global.fetch).toHaveBeenCalledTimes(servicesConfig.length);
    expect(prisma.service_cache.upsert).toHaveBeenCalledTimes(servicesConfig.length);
  });

  // Add more tests:
  // - Background fetch failure for a service (updates error fields in DB)
  // - globalFetchLock prevents concurrent background fetches for the same address
});
