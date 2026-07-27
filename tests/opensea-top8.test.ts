import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';

import { createHandler as createOpenSeaHandler } from '../src/pages/api/services/opensea';

const demoAddress = '0x1111111111111111111111111111111111111111';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function nft(
  identifier: string,
  estimatedValueUsd?: number | string,
  extra: Record<string, unknown> = {},
) {
  return {
    identifier,
    collection: extra.collection ?? 'test-collection',
    contract: `0x${identifier.padStart(40, '0')}`,
    token_standard: 'erc721',
    name: `NFT ${identifier}`,
    image_url: `https://images.example/${identifier}.png`,
    opensea_url: `https://opensea.io/assets/ethereum/test/${identifier}`,
    updated_at: '2026-07-27T00:00:00Z',
    is_disabled: false,
    is_nsfw: false,
    traits: [],
    ...(estimatedValueUsd === undefined ? {} : { estimated_value_usd: estimatedValueUsd }),
    ...extra,
  };
}

describe('OpenSea top-valued NFT collector', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.OPENSEA_API_KEY;
    process.env.OPENSEA_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.OPENSEA_API_KEY;
    } else {
      process.env.OPENSEA_API_KEY = originalKey;
    }
  });

  it('paginates, filters unsafe NFTs, sorts estimates, and fills eight with unvalued NFTs', async () => {
    const requests: Array<{ url: URL; signal?: AbortSignal | null }> = [];

    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      requests.push({ url, signal: init?.signal });

      if (!url.searchParams.has('next')) {
        return mockResponse({
          nfts: [
            nft('1', 100),
            nft('2'),
            nft('3', 1000, { is_disabled: true }),
            nft('4', 900, { is_nsfw: true }),
            nft('5', 50),
            nft('6', 0),
          ],
          next: 'page-two',
        });
      }

      return mockResponse({
        nfts: [
          nft('7', 200, { collection: 'premium-collection' }),
          nft('8', '25'),
          nft('9'),
          nft('10'),
          nft('11'),
          nft('12'),
        ],
      });
    };

    const handler = createOpenSeaHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      } as const,
      fetchFn,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();

    assert.equal(requests.length, 2);
    assert.equal(requests[0].url.searchParams.get('limit'), '200');
    assert.equal(requests[0].url.searchParams.has('next'), false);
    assert.equal(requests[1].url.searchParams.get('next'), 'page-two');
    assert.ok(requests.every((request) => request.signal instanceof AbortSignal));

    assert.equal(payload.source, 'opensea');
    assert.equal(payload.topValuedNFTs.length, 8);
    assert.deepEqual(
      payload.topValuedNFTs.map((item: { estimatedValueUsd?: number }) => item.estimatedValueUsd),
      [200, 100, 50, 25, 0, undefined, undefined, undefined],
    );
    assert.equal(payload.topValuedNFTs[0].currency, 'USD');
    assert.equal(payload.topValuedNFTs[0].estimatedValueSource, 'opensea_estimated_value_usd');
    assert.equal(payload.topValuedNFTs[0].valueLabel, 'OpenSea estimated value');
    assert.equal(payload.topValuedNFTs[5].estimatedValueSource, 'unavailable');
    assert.equal(payload.topValuedNFTs[5].valueLabel, 'Estimate unavailable');
    assert.equal('estimatedValue' in payload.topValuedNFTs[5], false);

    assert.deepEqual(payload.marketStats, {
      totalEstimatedValue: 375,
      totalFloorValue: 0,
      uniqueCollections: 2,
      totalNFTs: 10,
      fetchedNFTs: 12,
      valuedNFTs: 5,
      unvaluedNFTs: 5,
      excludedNFTs: 2,
      pagesFetched: 2,
      scanComplete: true,
      scanLimitReached: false,
      topCollectionsByValue: [
        {
          name: 'premium-collection',
          count: 1,
          floorPrice: 0,
          totalValue: 200,
        },
        {
          name: 'test-collection',
          count: 9,
          floorPrice: 0,
          totalValue: 175,
        },
      ],
    });
    assert.deepEqual(payload.portfolioSummary, {
      totalValue: 375,
      currency: 'USD',
      lastUpdated: payload.portfolioSummary.lastUpdated,
      valueSource: 'opensea_estimated_value_usd',
      isPartial: false,
    });
  });

  it('hard-caps pagination at three pages without per-NFT requests', async () => {
    let requestCount = 0;
    const fetchFn = async () => {
      requestCount++;
      return mockResponse({
        nfts: [nft(String(requestCount), requestCount)],
        next: `cursor-${requestCount}`,
      });
    };

    const handler = createOpenSeaHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      } as const,
      fetchFn,
      maxPages: 99,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    const payload = res._getJSONData();
    assert.equal(requestCount, 3);
    assert.equal(payload.marketStats.pagesFetched, 3);
    assert.equal(payload.marketStats.totalNFTs, 3);
    assert.equal(payload.marketStats.scanComplete, false);
    assert.equal(payload.marketStats.scanLimitReached, true);
    assert.equal(payload.portfolioSummary.isPartial, true);
  });

  it('keeps a successful first page when a later page fails', async () => {
    let requestCount = 0;
    const fetchFn = async () => {
      requestCount++;
      if (requestCount === 1) {
        return mockResponse({ nfts: [nft('1', 42)], next: 'page-two' });
      }
      return mockResponse({ error: 'upstream unavailable' }, 503);
    };

    const handler = createOpenSeaHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      } as const,
      fetchFn,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    const payload = res._getJSONData();
    assert.equal(payload.source, 'opensea');
    assert.equal(payload.warning, 'PARTIAL_SERVICE_ERROR');
    assert.equal(payload.error, undefined);
    assert.equal(payload.topValuedNFTs.length, 1);
    assert.equal(payload.marketStats.totalNFTs, 1);
    assert.equal(payload.marketStats.pagesFetched, 1);
    assert.equal(payload.marketStats.scanComplete, false);
    assert.equal(payload.marketStats.scanLimitReached, false);
  });
});
