import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createHandler } from '../src/pages/api/services/alchemy';

const demoAddress = '0x1111111111111111111111111111111111111111';
const otherAddress = '0x2222222222222222222222222222222222222222';
const expectedNetworks = [
  'eth-mainnet',
  'base-mainnet',
  'arb-mainnet',
  'opt-mainnet',
  'polygon-mainnet',
];

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function contractAddress(index: number): string {
  return `0x${index.toString(16).padStart(40, '0')}`;
}

function pricedToken(options: {
  index: number;
  value: number;
  network?: string;
  owner?: string;
  balance?: string;
  decimals?: number;
  isSpam?: boolean;
  includePrice?: boolean;
}) {
  const {
    index,
    value,
    network = 'base-mainnet',
    owner = demoAddress,
    balance = '1',
    decimals = 0,
    isSpam = false,
    includePrice = true,
  } = options;

  return {
    address: owner,
    network,
    tokenAddress: contractAddress(index),
    tokenBalance: balance,
    tokenMetadata: {
      decimals,
      logo: 'https://static.alchemyapi.io/images/assets/test.png',
      name: `Token ${index}`,
      symbol: `T${index}`,
    },
    tokenPrices: includePrice ? [{ currency: 'usd', value: String(value) }] : [],
    isSpam,
  };
}

describe('Alchemy priced holdings collector', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ALCHEMY_API_KEY;
    process.env.ALCHEMY_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ALCHEMY_API_KEY;
    } else {
      process.env.ALCHEMY_API_KEY = originalKey;
    }
  });

  it('paginates, filters, values, and returns the eight most valuable unique assets', async () => {
    const requestBodies: unknown[] = [];
    const fetchFn = async (_input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(init?.method, 'POST');
      assert.equal(typeof init?.body, 'string');
      requestBodies.push(JSON.parse(init.body as string) as unknown);

      if (requestBodies.length === 1) {
        return mockResponse({
          data: {
            tokens: [
              {
                address: demoAddress,
                network: 'eth-mainnet',
                tokenAddress: null,
                tokenBalance: '2000000000000000000',
                tokenMetadata: {
                  decimals: 18,
                  name: 'Ether',
                  symbol: 'ETH',
                },
                tokenPrices: [{ currency: 'usd', value: '2500' }],
              },
              {
                address: demoAddress,
                network: 'eth-mainnet',
                tokenAddress: contractAddress(100),
                tokenBalance: '1000000000',
                tokenMetadata: {
                  decimals: 6,
                  name: 'USD Coin',
                  symbol: 'USDC',
                },
                tokenPrices: [{ currency: 'USD', value: '1' }],
              },
              pricedToken({ index: 101, value: 1_000_000, isSpam: true }),
              pricedToken({ index: 102, value: 1_000_000, balance: '0' }),
              pricedToken({ index: 103, value: 1_000_000, includePrice: false }),
              pricedToken({ index: 104, value: 1_000_000, owner: otherAddress }),
            ],
            pageKey: 'second-page',
          },
        });
      }

      return mockResponse({
        data: {
          tokens: Array.from({ length: 8 }, (_, index) =>
            pricedToken({ index: index + 1, value: 800 - (index * 100) })
          ),
        },
      });
    };

    const handler = createHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      } as const,
      fetchFn,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: 'demo.eth' } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.source, 'alchemy');
    assert.deepEqual(payload.networks, expectedNetworks);
    assert.equal(payload.totalHoldings, 10);
    assert.equal(payload.totalValueUsd, 9600);
    assert.equal(payload.topHoldings.length, 8);
    assert.equal(payload.topHoldings[0].symbol, 'ETH');
    assert.equal(payload.topHoldings[0].balance, '2');
    assert.equal(payload.topHoldings[0].usdPrice, 2500);
    assert.equal(payload.topHoldings[0].usdValue, 5000);
    assert.equal(payload.topHoldings[1].symbol, 'USDC');
    assert.equal(payload.topHoldings.some((holding: { symbol: string }) => holding.symbol === 'T8'), false);

    assert.equal(requestBodies.length, 2);
    const firstBody = requestBodies[0] as {
      addresses: Array<{ address: string; networks: string[] }>;
      withMetadata: boolean;
      withPrices: boolean;
      includeNativeTokens: boolean;
      includeErc20Tokens: boolean;
      pageKey?: string;
    };
    const secondBody = requestBodies[1] as { pageKey?: string };
    assert.equal(firstBody.addresses[0].address, demoAddress);
    assert.deepEqual(firstBody.addresses[0].networks, expectedNetworks);
    assert.equal(firstBody.withMetadata, true);
    assert.equal(firstBody.withPrices, true);
    assert.equal(firstBody.includeNativeTokens, true);
    assert.equal(firstBody.includeErc20Tokens, true);
    assert.equal(firstBody.pageKey, undefined);
    assert.equal(secondBody.pageKey, 'second-page');
  });

  it('stops after three pages even when the provider keeps returning page keys', async () => {
    let fetchCount = 0;
    const fetchFn = async () => {
      fetchCount += 1;
      return mockResponse({
        data: {
          tokens: [pricedToken({ index: fetchCount, value: fetchCount })],
          pageKey: `page-${fetchCount}`,
        },
      });
    };

    const handler = createHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      } as const,
      fetchFn,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(fetchCount, 3);
    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.source, 'alchemy');
    assert.equal(payload.totalHoldings, 3);
    assert.equal(payload.totalValueUsd, 6);
    assert.deepEqual(
      payload.topHoldings.map((holding: { usdValue: number }) => holding.usdValue),
      [3, 2, 1],
    );
  });

  it('fails soft when Alchemy returns an invalid response shape', async () => {
    const handler = createHandler({
      ensClient: {
        getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
      } as const,
      fetchFn: async () => mockResponse({ data: { tokens: 'not-an-array' } }),
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.error, 'INVALID_RESPONSE');
    assert.equal(payload.source, 'none');
    assert.deepEqual(payload.topHoldings, []);
  });
});
