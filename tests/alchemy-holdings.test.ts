import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createHandler } from '../src/pages/api/services/alchemy';

const demoAddress = '0x1111111111111111111111111111111111111111';
const expectedNetworks = [
  'eth-mainnet',
  'base-mainnet',
  'arb-mainnet',
  'opt-mainnet',
  'polygon-mainnet',
];

type AlchemyRequestBody = {
  addresses: Array<{ address: string; networks: string[] }>;
  withMetadata: boolean;
  withPrices: boolean;
  includeNativeTokens: boolean;
  includeErc20Tokens: boolean;
  pageKey?: string;
};

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function contractAddress(index: number): string {
  return `0x${index.toString(16).padStart(40, '0')}`;
}

function readRequestBody(init?: RequestInit): AlchemyRequestBody {
  assert.equal(init?.method, 'POST');
  assert.equal(typeof init.body, 'string');
  return JSON.parse(init.body as string) as AlchemyRequestBody;
}

function nativeToken(options: {
  network?: string;
  balance?: string;
  price?: number;
}) {
  const {
    network = 'eth-mainnet',
    balance = '2000000000000000000',
    price = 2500,
  } = options;

  return {
    address: demoAddress,
    network,
    tokenAddress: null,
    tokenBalance: balance,
    // Alchemy's live native rows can omit all three fields.
    tokenMetadata: {
      name: null,
      symbol: null,
      decimals: null,
    },
    tokenPrices: [{ currency: 'usd', value: String(price) }],
  };
}

function alchemyPricedToken(options: {
  index: number;
  value: number;
  network?: string;
  symbol?: string;
}) {
  const {
    index,
    value,
    network = 'eth-mainnet',
    symbol = `T${index}`,
  } = options;

  return {
    address: demoAddress,
    network,
    tokenAddress: contractAddress(index),
    tokenBalance: '1',
    tokenMetadata: {
      decimals: 0,
      name: `Token ${index}`,
      symbol,
    },
    tokenPrices: [{ currency: 'usd', value: String(value) }],
  };
}

function etherscanToken(options: {
  index?: number;
  tokenAddress?: string;
  name?: string;
  symbol?: string;
  quantity?: string;
  decimals?: number;
  price?: number;
}) {
  const {
    index = 1,
    tokenAddress = contractAddress(index),
    name = `Token ${index}`,
    symbol = `T${index}`,
    quantity = '1',
    decimals = 0,
    price = 1,
  } = options;

  return {
    TokenAddress: tokenAddress,
    TokenName: name,
    TokenSymbol: symbol,
    TokenQuantity: quantity,
    TokenDivisor: String(decimals),
    TokenPriceUSD: String(price),
  };
}

function testEnsClient() {
  return {
    getAddressRecord: async () => ({ value: demoAddress, id: 60 }),
  } as const;
}

describe('priced holdings collector', () => {
  let originalAlchemyKey: string | undefined;
  let originalEtherscanKey: string | undefined;
  let originalRefreshToken: string | undefined;

  beforeEach(() => {
    originalAlchemyKey = process.env.ALCHEMY_API_KEY;
    originalEtherscanKey = process.env.ETHERSCAN_API_KEY;
    originalRefreshToken = process.env.PROFILE_REFRESH_TOKEN;
    process.env.ALCHEMY_API_KEY = 'test-alchemy-key';
    delete process.env.ETHERSCAN_API_KEY;
    delete process.env.PROFILE_REFRESH_TOKEN;
  });

  afterEach(() => {
    if (originalAlchemyKey === undefined) {
      delete process.env.ALCHEMY_API_KEY;
    } else {
      process.env.ALCHEMY_API_KEY = originalAlchemyKey;
    }

    if (originalEtherscanKey === undefined) {
      delete process.env.ETHERSCAN_API_KEY;
    } else {
      process.env.ETHERSCAN_API_KEY = originalEtherscanKey;
    }

    if (originalRefreshToken === undefined) {
      delete process.env.PROFILE_REFRESH_TOKEN;
    } else {
      process.env.PROFILE_REFRESH_TOKEN = originalRefreshToken;
    }
  });

  it('rejects public production calls before contacting either provider', async () => {
    process.env.PROFILE_REFRESH_TOKEN = 'test-refresh-token';
    let providerCalled = false;
    const handler = createHandler({
      ensClient: testEnsClient(),
      fetchFn: async () => {
        providerCalled = true;
        return mockResponse({});
      },
      enforceInternalAccess: true,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 404);
    assert.deepEqual(res._getJSONData(), { error: 'Not Found' });
    assert.equal(providerCalled, false);
  });

  it('shows only native balances when the licensed Etherscan feed is not configured', async () => {
    const requestBodies: AlchemyRequestBody[] = [];
    const fetchFn = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = readRequestBody(init);
      requestBodies.push(body);
      const network = body.addresses[0].networks[0];

      assert.equal(body.includeNativeTokens, true);
      assert.equal(body.includeErc20Tokens, true);
      assert.equal(body.addresses[0].networks.length, 1);

      if (network === 'eth-mainnet') {
        return mockResponse({
          data: {
            tokens: [
              nativeToken({}),
              alchemyPricedToken({
                index: 99,
                value: 138_000,
                symbol: 'MOODENG',
              }),
            ],
            pageKey: 'uncurated-token-cursor',
          },
        });
      }

      return mockResponse({ data: { tokens: [] } });
    };

    const handler = createHandler({
      ensClient: testEnsClient(),
      fetchFn,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: 'demo.eth' } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.schemaVersion, 4);
    assert.equal(payload.source, 'alchemy');
    assert.equal(payload.scanComplete, false);
    assert.equal(payload.isPartial, true);
    assert.equal(payload.valueSemantics, 'native-only');
    assert.equal(payload.nativeComplete, true);
    assert.equal(payload.requiresEtherscanApiKey, true);
    assert.equal(payload.warning, 'ETHERSCAN_API_KEY_REQUIRED');
    assert.deepEqual(payload.incompleteNetworks, expectedNetworks);
    assert.deepEqual(payload.networks, expectedNetworks);
    assert.equal(payload.pagesFetched, 5);
    assert.equal(payload.totalHoldings, 1);
    assert.equal(payload.totalValueUsd, 5000);
    assert.equal(payload.topHoldings[0].symbol, 'ETH');
    assert.equal(payload.topHoldings[0].tokenAddress, null);
    assert.equal(
      payload.topHoldings.some((holding: { symbol: string }) => holding.symbol === 'MOODENG'),
      false,
    );
    assert.equal(requestBodies.length, 5);
    assert.ok(requestBodies.every((body) => body.withMetadata && body.withPrices));
  });

  it('combines Etherscan ERC-20 holdings with Alchemy native balances', async () => {
    process.env.ETHERSCAN_API_KEY = 'test-etherscan-key';
    const etherscanRequests: URL[] = [];
    const waits: number[] = [];
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'GET') {
        const url = new URL(String(input));
        etherscanRequests.push(url);
        const chainId = url.searchParams.get('chainid');

        if (chainId === '1') {
          return mockResponse({
            status: '1',
            message: 'OK',
            result: [
              etherscanToken({
                tokenAddress: '0xdd974d5c2e2928dea5f71b9825b8b646686bd200',
                name: 'KyberNetwork',
                symbol: 'KNC',
                quantity: '1000000000000000000000',
                decimals: 18,
                price: 75,
              }),
              etherscanToken({
                tokenAddress: '0xd26114cd6ee289accf82350c8d8487fedb8a0c07',
                name: 'OMG Network',
                symbol: 'OMG',
                quantity: '100000000000000000000',
                decimals: 18,
                price: 56,
              }),
              etherscanToken({
                index: 200,
                symbol: 'UNPRICED',
                price: 0,
              }),
            ],
          });
        }

        return mockResponse({
          status: '0',
          message: 'No records found',
          result: [],
        });
      }

      const body = readRequestBody(init);
      const network = body.addresses[0].networks[0];
      return mockResponse({
        data: {
          tokens: network === 'eth-mainnet' ? [nativeToken({})] : [],
        },
      });
    };

    const handler = createHandler({
      ensClient: testEnsClient(),
      fetchFn,
      sleepFn: async (milliseconds: number) => {
        waits.push(milliseconds);
      },
      now: () => 1_000,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.schemaVersion, 4);
    assert.equal(payload.source, 'etherscan+alchemy');
    assert.equal(payload.scanComplete, true);
    assert.equal(payload.isPartial, false);
    assert.equal(payload.valueSemantics, 'priced-total');
    assert.equal(payload.nativeComplete, true);
    assert.equal(payload.requiresEtherscanApiKey, false);
    assert.equal(payload.warning, undefined);
    assert.deepEqual(payload.incompleteNetworks, []);
    assert.equal(payload.pagesFetched, 10);
    assert.equal(payload.totalHoldings, 3);
    assert.equal(payload.totalValueUsd, 85_600);
    assert.equal(payload.topHoldings[0].symbol, 'KNC');
    assert.equal(payload.topHoldings[0].usdValue, 75_000);
    assert.equal(payload.topHoldings[1].symbol, 'OMG');
    assert.equal(payload.topHoldings[2].symbol, 'ETH');
    assert.equal(payload.networkScans['eth-mainnet'].pagesFetched, 2);
    assert.equal(payload.networkScans['eth-mainnet'].nativeFetched, true);
    assert.equal(payload.networkScans['eth-mainnet'].etherscanPagesFetched, 1);

    assert.equal(etherscanRequests.length, 5);
    for (const url of etherscanRequests) {
      assert.equal(url.origin, 'https://api.etherscan.io');
      assert.equal(url.searchParams.get('module'), 'account');
      assert.equal(url.searchParams.get('action'), 'addresstokenbalance');
      assert.equal(url.searchParams.get('address'), demoAddress);
      assert.equal(url.searchParams.get('page'), '1');
      assert.equal(url.searchParams.get('offset'), '100');
      assert.equal(url.searchParams.get('apikey'), 'test-etherscan-key');
    }
    assert.deepEqual(waits, [550, 550, 550, 550]);
    assert.equal(JSON.stringify(payload).includes('test-etherscan-key'), false);
  });

  it('stays under the Cloudflare Free subrequest limit at every page cap', async () => {
    process.env.ETHERSCAN_API_KEY = 'test-etherscan-key';
    let requestCount = 0;
    let etherscanRequestCount = 0;
    const requestsByChain = new Map<string, number>();
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestCount += 1;

      if (init?.method === 'GET') {
        etherscanRequestCount += 1;
        const url = new URL(String(input));
        const chainId = url.searchParams.get('chainid') ?? '';
        const page = Number(url.searchParams.get('page'));
        requestsByChain.set(chainId, (requestsByChain.get(chainId) ?? 0) + 1);
        const addressOffset = Number(chainId) * 100_000 + page * 100;

        return mockResponse({
          status: '1',
          message: 'OK',
          result: Array.from({ length: 100 }, (_, index) =>
            etherscanToken({
              index: addressOffset + index,
              price: addressOffset + index + 1,
            })
          ),
        });
      }

      readRequestBody(init);
      return mockResponse({ data: { tokens: [] } });
    };

    const handler = createHandler({
      ensClient: testEnsClient(),
      fetchFn,
      sleepFn: async () => undefined,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(requestCount, 18);
    assert.equal(etherscanRequestCount, 13);
    assert.equal(requestsByChain.get('1'), 5);
    assert.equal(requestsByChain.get('8453'), 2);
    assert.equal(requestsByChain.get('42161'), 2);
    assert.equal(requestsByChain.get('10'), 2);
    assert.equal(requestsByChain.get('137'), 2);
    assert.equal(payload.pagesFetched, 18);
    assert.equal(payload.totalHoldings, 1300);
    assert.equal(payload.topHoldings.length, 8);
    assert.equal(payload.scanComplete, false);
    assert.equal(payload.isPartial, true);
    assert.equal(payload.valueSemantics, 'priced-lower-bound');
    assert.deepEqual(payload.incompleteNetworks, expectedNetworks);
  });

  it('falls back to native-only data when Etherscan rejects the configured key', async () => {
    process.env.ETHERSCAN_API_KEY = 'invalid-etherscan-key';
    const fetchFn = async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'GET') {
        return mockResponse({
          status: '0',
          message: 'NOTOK',
          result: 'Invalid API Key',
        });
      }

      const body = readRequestBody(init);
      const network = body.addresses[0].networks[0];
      return mockResponse({
        data: {
          tokens: network === 'eth-mainnet'
            ? [
                nativeToken({}),
                alchemyPricedToken({
                  index: 77,
                  value: 138_000,
                  symbol: 'MOODENG',
                }),
              ]
            : [],
        },
      });
    };

    const handler = createHandler({
      ensClient: testEnsClient(),
      fetchFn,
      sleepFn: async () => undefined,
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.source, 'alchemy');
    assert.equal(payload.valueSemantics, 'native-only');
    assert.equal(payload.warning, 'ETHERSCAN_API_UNAVAILABLE');
    assert.equal(payload.requiresEtherscanApiKey, false);
    assert.equal(payload.totalValueUsd, 5000);
    assert.equal(payload.totalHoldings, 1);
    assert.equal(payload.topHoldings[0].symbol, 'ETH');
    assert.equal(
      payload.topHoldings.some((holding: { symbol: string }) => holding.symbol === 'MOODENG'),
      false,
    );
  });

  it('fails soft when every configured provider returns an invalid response', async () => {
    const handler = createHandler({
      ensClient: testEnsClient(),
      fetchFn: async () => mockResponse({ data: { tokens: 'not-an-array' } }),
    });
    const { req, res } = createMocks({ method: 'GET', query: { address: demoAddress } });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    const payload = res._getJSONData();
    assert.equal(payload.schemaVersion, 4);
    assert.equal(payload.error, 'INVALID_RESPONSE');
    assert.equal(payload.source, 'none');
    assert.equal(payload.isPartial, true);
    assert.deepEqual(payload.topHoldings, []);
  });
});
