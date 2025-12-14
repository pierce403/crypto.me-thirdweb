import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createHandler as createEnsHandler } from '../src/pages/api/services/ens';
import { createHandler as createFarcasterHandler } from '../src/pages/api/services/farcaster';

const demoAddress = '0x1111111111111111111111111111111111111111';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ENS service collector', () => {
  it('resolves names and other records using injected dependencies', async () => {
    const ensClientMock = {
      getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      getName: async () => ({ name: 'demo.eth' }),
      getTextRecord: async () => null,
    } as const;

    const fetchFn = async () =>
      mockResponse({ data: { domains: [{ name: 'demo.eth' }, { name: 'alt.eth' }] } });

    const handler = createEnsHandler({ ensClient: ensClientMock, fetchFn });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.primaryName, 'demo.eth');
    assert.deepEqual(payload.otherNames, ['alt.eth']);
    assert.ok(payload.profileUrl.includes('demo.eth'));
  });

  it('fails fast when address is missing', async () => {
    const handler = createEnsHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
        getName: async () => null,
        getTextRecord: async () => null,
      } as const,
      fetchFn: async () => mockResponse({ data: { domains: [] } }),
    });

    const { req, res } = createMocks({ method: 'GET', query: {} });
    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 400);
    assert.ok(res._getJSONData().error);
  });
});

describe('Farcaster service collector', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.NEYNAR_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.NEYNAR_API_KEY;
    } else {
      process.env.NEYNAR_API_KEY = originalKey;
    }
  });

  it('returns a normalized Neynar payload for an address', async () => {
    process.env.NEYNAR_API_KEY = 'test-key';

    const fetchFn = async () =>
      mockResponse({
        [demoAddress.toLowerCase()]: [
          {
            username: 'collector',
            display_name: 'Collector',
            created_at: Date.now(),
            follower_count: 12,
            following_count: 4,
            power_badge: true,
            score: 0.9,
            verified_addresses: { eth_addresses: [demoAddress] },
          },
        ],
      });

    const handler = createFarcasterHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      } as const,
      fetchFn,
    });

    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });
    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.username, 'collector');
    assert.equal(payload.resolvedAddress, demoAddress);
    assert.equal(payload.neynarScore, 0.9);
    assert.ok(payload.followerCount >= 0);
  });

  it('surfaces a configuration error when the API key is missing', async () => {
    delete process.env.NEYNAR_API_KEY;

    const handler = createFarcasterHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      } as const,
      fetchFn: async () => mockResponse({}, 401),
    });

    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });
    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 500);
    assert.ok(res._getJSONData().error);
  });
});
