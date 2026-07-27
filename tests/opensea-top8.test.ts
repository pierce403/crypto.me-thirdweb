import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createMocks } from 'node-mocks-http';

import { createHandler as createOpenSeaHandler } from '../src/pages/api/services/opensea';

const demoAddress = '0x1111111111111111111111111111111111111111';
const contracts = {
  a: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  b: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  c: '0xcccccccccccccccccccccccccccccccccccccccc',
  d: '0xdddddddddddddddddddddddddddddddddddddddd',
  e: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
};

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Mirrors OpenSea's real Nft shape. estimated_value_usd is intentionally
// absent unless a test explicitly supplies the optional field.
function openSeaNFT(
  identifier: string,
  contract: string,
  extra: Record<string, unknown> = {},
) {
  return {
    identifier,
    collection: `collection-${contract.slice(2, 4)}`,
    contract,
    token_standard: 'erc721',
    name: `NFT ${identifier}`,
    image_url: `https://images.example/${identifier}.png`,
    opensea_url: `https://opensea.io/assets/ethereum/${contract}/${identifier}`,
    updated_at: '2026-07-27T00:00:00Z',
    is_disabled: false,
    is_nsfw: false,
    traits: [],
    ...extra,
  };
}

// Mirrors Alchemy getNFTsForOwner v3: floorPrice is ETH-denominated OpenSea
// collection metadata nested under each owned NFT's contract.
function alchemyOwnedNFT(
  contract: string,
  floorPrice: number | null,
  collectionSlug = `collection-${contract.slice(2, 4)}`,
) {
  return {
    contract: {
      address: contract,
      name: `Collection ${contract.slice(2, 4)}`,
      tokenType: 'ERC721',
      openSeaMetadata: {
        floorPrice,
        collectionName: `Collection ${contract.slice(2, 4)}`,
        safelistRequestStatus: 'verified',
      },
      isSpam: null,
      spamClassifications: [],
    },
    tokenId: '1',
    tokenType: 'ERC721',
    name: 'Alchemy NFT',
    collection: {
      name: `Collection ${contract.slice(2, 4)}`,
      slug: collectionSlug,
      externalUrl: null,
      bannerImageUrl: null,
    },
    image: {
      cachedUrl: 'https://nft-cdn.alchemy.com/example',
      thumbnailUrl: null,
      pngUrl: null,
      originalUrl: null,
    },
    raw: { metadata: {}, error: null },
    balance: '1',
  };
}

function ethPrice(value: string | number) {
  return {
    data: [{
      symbol: 'ETH',
      prices: [{
        currency: 'USD',
        value,
        lastUpdatedAt: '2026-07-27T00:00:00Z',
      }],
      error: null,
    }],
  };
}

function makeHandler(fetchFn: typeof fetch, options: {
  maxPages?: number;
  maxAlchemyPages?: number;
} = {}) {
  return createOpenSeaHandler({
    ensClient: {
      getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
    } as const,
    fetchFn,
    ...options,
  });
}

async function invoke(fetchFn: typeof fetch, options?: {
  maxPages?: number;
  maxAlchemyPages?: number;
}) {
  const handler = makeHandler(fetchFn, options);
  const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

describe('OpenSea top-valued NFT collector', () => {
  let originalOpenSeaKey: string | undefined;
  let originalAlchemyKey: string | undefined;

  beforeEach(() => {
    originalOpenSeaKey = process.env.OPENSEA_API_KEY;
    originalAlchemyKey = process.env.ALCHEMY_API_KEY;
    process.env.OPENSEA_API_KEY = 'opensea-test-key';
    process.env.ALCHEMY_API_KEY = 'alchemy-test-key';
  });

  afterEach(() => {
    if (originalOpenSeaKey === undefined) {
      delete process.env.OPENSEA_API_KEY;
    } else {
      process.env.OPENSEA_API_KEY = originalOpenSeaKey;
    }

    if (originalAlchemyKey === undefined) {
      delete process.env.ALCHEMY_API_KEY;
    } else {
      process.env.ALCHEMY_API_KEY = originalAlchemyKey;
    }
  });

  it('ranks real-shaped OpenSea inventory with Alchemy collection-floor proxies', async () => {
    const openSeaRequests: URL[] = [];
    const alchemyNFTRequests: URL[] = [];
    const priceRequests: URL[] = [];

    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.ok(init?.signal instanceof AbortSignal);

      if (url.hostname === 'api.opensea.io') {
        openSeaRequests.push(url);
        if (!url.searchParams.has('next')) {
          return mockResponse({
            nfts: [
              openSeaNFT('1', contracts.a, { collection: 'shared-collection' }),
              openSeaNFT('2', contracts.b, { collection: 'shared-collection' }),
              // A direct item estimate must win even when the collection floor
              // proxy would be numerically higher.
              openSeaNFT('3', contracts.c, { estimated_value_usd: 100 }),
              openSeaNFT('unsafe', contracts.e, {
                estimated_value_usd: 10000,
                is_nsfw: true,
              }),
            ],
            next: 'open-sea-page-two',
          });
        }

        return mockResponse({
          nfts: [
            openSeaNFT('4', contracts.d, { estimated_value_usd: 0 }),
            openSeaNFT('5', contracts.e),
            // The same contract may back multiple OpenSea collection slugs.
            // A floor for one slug must not leak into another.
            openSeaNFT('6', contracts.a, { collection: 'different-subcollection' }),
          ],
        });
      }

      if (
        url.hostname === 'eth-mainnet.g.alchemy.com' &&
        url.pathname.endsWith('/getNFTsForOwner')
      ) {
        alchemyNFTRequests.push(url);
        if (!url.searchParams.has('pageKey')) {
          return mockResponse({
            ownedNfts: [
              alchemyOwnedNFT(contracts.a, 0.1, 'shared-collection'),
              alchemyOwnedNFT(contracts.b, 0.2, 'shared-collection'),
              alchemyOwnedNFT(contracts.c, 1),
            ],
            totalCount: 5,
            pageKey: 'alchemy-page-two',
          });
        }

        return mockResponse({
          ownedNfts: [
            alchemyOwnedNFT(contracts.d, 0.05),
            alchemyOwnedNFT(contracts.e, null),
          ],
          totalCount: 5,
          pageKey: null,
        });
      }

      if (
        url.hostname === 'api.g.alchemy.com' &&
        url.pathname.endsWith('/tokens/by-symbol')
      ) {
        priceRequests.push(url);
        return mockResponse(ethPrice('2000'));
      }

      throw new Error(`Unexpected request: ${url}`);
    };

    const res = await invoke(fetchFn);
    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();

    assert.equal(openSeaRequests.length, 2);
    assert.equal(openSeaRequests[0].searchParams.get('limit'), '200');
    assert.equal(openSeaRequests[1].searchParams.get('next'), 'open-sea-page-two');

    assert.equal(alchemyNFTRequests.length, 2);
    assert.equal(alchemyNFTRequests[0].searchParams.get('owner'), demoAddress);
    assert.equal(alchemyNFTRequests[0].searchParams.get('withMetadata'), 'true');
    assert.equal(alchemyNFTRequests[0].searchParams.get('pageSize'), '100');
    assert.equal(alchemyNFTRequests[0].searchParams.get('tokenUriTimeoutInMs'), '0');
    assert.equal(alchemyNFTRequests[1].searchParams.get('pageKey'), 'alchemy-page-two');
    assert.equal(priceRequests.length, 1);
    assert.equal(priceRequests[0].searchParams.get('symbols'), 'ETH');

    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.source, 'opensea');
    assert.equal(payload.valuationStatus, 'partial');
    assert.deepEqual(
      payload.topValuedNFTs.map((item: {
        name: string;
        estimatedValueUsd: number;
        valuationSource: string;
      }) => [item.name, item.estimatedValueUsd, item.valuationSource]),
      [
        ['NFT 2', 400, 'alchemy_opensea_collection_floor'],
        ['NFT 1', 200, 'alchemy_opensea_collection_floor'],
        ['NFT 3', 100, 'opensea_estimated_value_usd'],
        ['NFT 4', 100, 'alchemy_opensea_collection_floor'],
      ],
    );
    assert.equal(payload.topValuedNFTs[0].floorPriceEth, 0.2);
    assert.equal(payload.topValuedNFTs[0].floorPriceCurrency, 'ETH');
    assert.equal(payload.topValuedNFTs[0].valueLabel, 'Collection floor proxy');
    assert.equal(payload.topValuedNFTs[2].valueLabel, 'OpenSea item estimate');

    assert.deepEqual(
      payload.nftPreview.map((item: { name: string; valuationSource: string }) => [
        item.name,
        item.valuationSource,
      ]),
      [
        ['NFT 5', 'unavailable'],
        ['NFT 6', 'unavailable'],
      ],
    );
    assert.ok(payload.nftPreview.every(
      (item: Record<string, unknown>) => !('estimatedValueUsd' in item),
    ));

    assert.equal(payload.marketStats.totalEstimatedValue, 800);
    assert.equal(payload.marketStats.totalFloorValue, 700);
    assert.equal(payload.marketStats.valuedNFTs, 4);
    assert.equal(payload.marketStats.directValuedNFTs, 1);
    assert.equal(payload.marketStats.floorValuedNFTs, 3);
    assert.equal(payload.marketStats.unvaluedNFTs, 2);
    assert.equal(payload.marketStats.excludedNFTs, 1);
    assert.equal(payload.marketStats.scanComplete, true);
    assert.ok(payload.marketStats.topCollectionsByValue.every(
      (collection: { totalValue: number }) => collection.totalValue > 0,
    ));
    assert.equal(
      payload.marketStats.topCollectionsByValue.find(
        (collection: { name: string }) => collection.name === 'shared-collection',
      ).floorPrice,
      0.1,
    );
    assert.deepEqual(payload.portfolioSummary, {
      totalValue: 800,
      currency: 'USD',
      lastUpdated: payload.portfolioSummary.lastUpdated,
      valueSource: 'mixed_direct_and_collection_floor',
      isPartial: true,
    });
  });

  it('keeps inventory useful without an Alchemy key and never treats zero as valued', async () => {
    delete process.env.ALCHEMY_API_KEY;
    const requests: URL[] = [];
    const nfts = [
      openSeaNFT('zero', contracts.a, { estimated_value_usd: 0 }),
      ...Array.from({ length: 8 }, (_, index) =>
        openSeaNFT(`unvalued-${index + 1}`, contracts.b)),
    ];

    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      return mockResponse({ nfts });
    };

    const res = await invoke(fetchFn);
    const payload = res._getJSONData();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].hostname, 'api.opensea.io');
    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.source, 'opensea');
    assert.equal(payload.valuationStatus, 'unavailable');
    assert.deepEqual(payload.topValuedNFTs, []);
    assert.equal(payload.nftPreview.length, 8);
    assert.equal(payload.nftPreview[0].name, 'NFT zero');
    assert.equal(payload.nftPreview[0].valuationSource, 'unavailable');
    assert.equal('estimatedValueUsd' in payload.nftPreview[0], false);
    assert.equal(payload.marketStats.valuedNFTs, 0);
    assert.equal(payload.marketStats.unvaluedNFTs, 9);
    assert.deepEqual(payload.marketStats.topCollectionsByValue, []);
    assert.equal(payload.portfolioSummary.valueSource, 'unavailable');
    assert.equal(payload.portfolioSummary.totalValue, 0);
    assert.equal(payload.portfolioSummary.isPartial, true);
  });

  it('uses complete positive OpenSea item estimates without calling the fallback', async () => {
    const requests: URL[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      return mockResponse({
        nfts: [
          openSeaNFT('1', contracts.a, { estimated_value_usd: 25 }),
          openSeaNFT('2', contracts.b, { estimated_value_usd: '75' }),
        ],
      });
    };

    const res = await invoke(fetchFn);
    const payload = res._getJSONData();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].hostname, 'api.opensea.io');
    assert.equal(payload.valuationStatus, 'available');
    assert.deepEqual(
      payload.topValuedNFTs.map((item: { estimatedValueUsd: number }) => item.estimatedValueUsd),
      [75, 25],
    );
    assert.deepEqual(payload.nftPreview, []);
    assert.equal(payload.portfolioSummary.valueSource, 'opensea_estimated_value_usd');
    assert.equal(payload.portfolioSummary.isPartial, false);
  });

  it('hard-caps both OpenSea and Alchemy pagination at three pages', async () => {
    let openSeaRequestCount = 0;
    let alchemyNFTRequestCount = 0;
    let priceRequestCount = 0;

    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));

      if (url.hostname === 'api.opensea.io') {
        openSeaRequestCount++;
        const contract = [contracts.a, contracts.b, contracts.c][openSeaRequestCount - 1];
        return mockResponse({
          nfts: [openSeaNFT(
            String(openSeaRequestCount),
            contract,
            { estimated_value_usd: openSeaRequestCount },
          )],
          next: `open-sea-cursor-${openSeaRequestCount}`,
        });
      }

      if (url.pathname.endsWith('/getNFTsForOwner')) {
        alchemyNFTRequestCount++;
        return mockResponse({
          ownedNfts: [],
          pageKey: `alchemy-cursor-${alchemyNFTRequestCount}`,
        });
      }

      if (url.pathname.endsWith('/tokens/by-symbol')) {
        priceRequestCount++;
        return mockResponse(ethPrice(2000));
      }

      throw new Error(`Unexpected request: ${url}`);
    };

    const res = await invoke(fetchFn, { maxPages: 99, maxAlchemyPages: 99 });
    const payload = res._getJSONData();

    assert.equal(openSeaRequestCount, 3);
    assert.equal(alchemyNFTRequestCount, 3);
    assert.equal(priceRequestCount, 1);
    assert.equal(payload.schemaVersion, 2);
    assert.deepEqual(
      payload.topValuedNFTs.map((item: { estimatedValueUsd: number }) => item.estimatedValueUsd),
      [3, 2, 1],
    );
    assert.equal(payload.marketStats.pagesFetched, 3);
    assert.equal(payload.marketStats.totalNFTs, 3);
    assert.equal(payload.marketStats.scanComplete, false);
    assert.equal(payload.marketStats.scanLimitReached, true);
    assert.equal(payload.valuationStatus, 'partial');
    assert.equal(payload.portfolioSummary.isPartial, true);
  });

  it('retains successful OpenSea inventory when later OpenSea and Alchemy calls fail', async () => {
    let openSeaRequestCount = 0;

    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));

      if (url.hostname === 'api.opensea.io') {
        openSeaRequestCount++;
        if (openSeaRequestCount === 1) {
          return mockResponse({
            nfts: [openSeaNFT('1', contracts.a)],
            next: 'open-sea-page-two',
          });
        }
        return mockResponse({ error: 'upstream unavailable' }, 503);
      }

      return mockResponse({ error: 'alchemy unavailable' }, 503);
    };

    const res = await invoke(fetchFn);
    const payload = res._getJSONData();

    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.source, 'opensea');
    assert.equal(payload.error, undefined);
    assert.equal(payload.warning, 'PARTIAL_SERVICE_ERROR');
    assert.equal(payload.valuationStatus, 'unavailable');
    assert.deepEqual(payload.topValuedNFTs, []);
    assert.equal(payload.nftPreview.length, 1);
    assert.equal(payload.nftPreview[0].name, 'NFT 1');
    assert.equal(payload.marketStats.pagesFetched, 1);
    assert.equal(payload.marketStats.scanComplete, false);
    assert.equal(payload.marketStats.scanLimitReached, false);
  });

  it('returns the v2 empty schema when the OpenSea key is missing', async () => {
    delete process.env.OPENSEA_API_KEY;
    let requestCount = 0;
    const fetchFn: typeof fetch = async () => {
      requestCount++;
      return mockResponse({}, 500);
    };

    const res = await invoke(fetchFn);
    const payload = res._getJSONData();

    assert.equal(requestCount, 0);
    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.error, 'OPENSEA_API_KEY_REQUIRED');
    assert.equal(payload.source, 'none');
    assert.equal(payload.valuationStatus, 'unavailable');
    assert.deepEqual(payload.topValuedNFTs, []);
    assert.deepEqual(payload.nftPreview, []);
    assert.equal(payload.portfolioSummary.valueSource, 'unavailable');
  });
});
