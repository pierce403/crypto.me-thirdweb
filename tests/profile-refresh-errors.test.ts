import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  refreshProfileService,
  type ProfileRefreshStore,
} from '../src/lib/profileRefresh';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function createStore(writes: unknown[]): ProfileRefreshStore {
  return {
    service_cache: {
      async upsert(args) {
        writes.push(args);
        return {};
      },
    },
  };
}

describe('profile refresh semantic errors', () => {
  it('authenticates service-binding collector requests without exposing the token in the URL', async () => {
    const writes: unknown[] = [];
    let requestedUrl = '';
    let refreshHeader: string | null = null;
    const result = await refreshProfileService(
      createStore(writes),
      {
        address: '0x7ab874Eeef0169ADA0d225E9801A3FfFfa26aAC3',
        service: 'alchemy',
      },
      async (input, init) => {
        requestedUrl = String(input);
        refreshHeader = new Headers(init?.headers).get('x-crypto-me-refresh-token');
        return Response.json({
          schemaVersion: 4,
          source: 'alchemy',
          isPartial: true,
          scanComplete: false,
          valueSemantics: 'native-only',
          totalValueUsd: 100,
          topHoldings: [{ symbol: 'ETH', usdValue: 100 }],
        });
      },
      'https://crypto.me',
      'test-refresh-token',
    );

    assert.equal(result, 'updated');
    assert.equal(refreshHeader, 'test-refresh-token');
    assert.equal(requestedUrl.includes('test-refresh-token'), false);
    assert.equal(writes.length, 1);
  });

  it('backs off a fail-soft HTTP 200 payload containing an error', async () => {
    const writes: unknown[] = [];
    const result = await refreshProfileService(
      createStore(writes),
      {
        address: '0x7ab874Eeef0169ADA0d225E9801A3FfFfa26aAC3',
        service: 'alchemy',
      },
      async () => Response.json({
        source: 'none',
        error: 'API_ERROR',
        topHoldings: [],
      }),
      'https://crypto.me',
    );

    assert.equal(result, 'upstream-error');
    assert.equal(writes.length, 1);
    const write = writes[0];
    assert.ok(isRecord(write));
    assert.ok(isRecord(write.update));
    assert.deepEqual(write.update.error_count, { increment: 1 });
    assert.equal(write.update.last_error, 'API_ERROR');
    assert.ok(write.update.expires_at instanceof Date);
  });

  it('accepts a successful payload whose error field is null', async () => {
    const writes: unknown[] = [];
    const payload = {
      source: 'alchemy',
      error: null,
      topHoldings: [{ symbol: 'ETH', usdValue: 100 }],
    };
    const result = await refreshProfileService(
      createStore(writes),
      {
        address: '0x7ab874Eeef0169ADA0d225E9801A3FfFfa26aAC3',
        service: 'alchemy',
      },
      async () => Response.json(payload),
      'https://crypto.me',
    );

    assert.equal(result, 'updated');
    assert.equal(writes.length, 1);
    const write = writes[0];
    assert.ok(isRecord(write));
    assert.ok(isRecord(write.update));
    assert.equal(write.update.data, JSON.stringify(payload));
    assert.equal(write.update.error_count, 0);
    assert.equal(write.update.last_error, null);
    assert.ok(write.update.last_updated instanceof Date);
    assert.ok(write.update.expires_at instanceof Date);
    assert.equal(
      write.update.expires_at.getTime() - write.update.last_updated.getTime(),
      30 * 60 * 1000,
    );
  });

  it('keeps a complete priced Alchemy portfolio cached for 24 hours', async () => {
    const writes: unknown[] = [];
    const payload = {
      schemaVersion: 4,
      source: 'etherscan+alchemy',
      isPartial: false,
      scanComplete: true,
      valueSemantics: 'priced-total',
      totalValueUsd: 100,
      topHoldings: [{ symbol: 'ETH', usdValue: 100 }],
    };
    const result = await refreshProfileService(
      createStore(writes),
      {
        address: '0x7ab874Eeef0169ADA0d225E9801A3FfFfa26aAC3',
        service: 'alchemy',
      },
      async () => Response.json(payload),
      'https://crypto.me',
    );

    assert.equal(result, 'updated');
    assert.equal(writes.length, 1);
    const write = writes[0];
    assert.ok(isRecord(write));
    assert.ok(isRecord(write.update));
    assert.ok(write.update.last_updated instanceof Date);
    assert.ok(write.update.expires_at instanceof Date);
    assert.equal(
      write.update.expires_at.getTime() - write.update.last_updated.getTime(),
      24 * 60 * 60 * 1000,
    );
  });
});
