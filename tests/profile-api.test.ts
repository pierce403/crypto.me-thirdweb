import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMocks } from 'node-mocks-http';
import type { PrismaClient } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getEnsRpcUrls, safeEnsError } from '../src/lib/ensClient';
import { createHandler, resolveEnsProfile } from '../src/pages/api/profile';

const deanAddress = '0x7ab874Eeef0169ADA0d225E9801A3FfFfa26aAC3';

function resolver(overrides: {
  getAddressRecord?: () => Promise<{ value: string; id: number } | null>;
  getTextRecord?: () => Promise<string | null>;
} = {}) {
  return {
    getAddressRecord: overrides.getAddressRecord ?? (async () => ({ value: deanAddress, id: 60 })),
    getTextRecord: overrides.getTextRecord ?? (async () => null),
  };
}

function unavailableDatabaseDependencies(ensClient = resolver()) {
  return {
    ensClient,
    getPrisma: (() => {
      throw new Error('database unavailable');
    }) as () => PrismaClient,
    withPrisma: (async () => {
      throw new Error('not expected');
    }) as never,
  };
}

describe('ENS profile API', () => {
  it('keeps public fallback RPCs behind an optional configured provider', () => {
    const urls = getEnsRpcUrls({ ALCHEMY_RPC_URL: 'https://rpc.example.test' });

    assert.deepEqual(urls, [
      'https://rpc.example.test',
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
    ]);
  });

  it('redacts provider URLs from structured RPC errors', () => {
    const error = Object.assign(new Error('request failed'), {
      name: 'HttpRequestError',
      shortMessage: 'Request failed at https://eth-mainnet.g.alchemy.com/v2/secret-key',
      status: 401,
    });
    const summary = safeEnsError(error);

    assert.equal(summary.status, 401);
    assert.equal(summary.shortMessage, 'Request failed at [redacted-url]');
    assert.equal(JSON.stringify(summary).includes('secret-key'), false);
  });

  it('returns a resolved address when the optional avatar lookup fails', async () => {
    const profile = await resolveEnsProfile('deanpierce.eth', resolver({
      getTextRecord: async () => {
        throw new Error('avatar provider failed');
      },
    }));

    assert.equal(profile?.address, deanAddress);
    assert.equal(profile?.profile_data.ens_avatar, null);
  });

  it('preserves a cached avatar when its refresh lookup fails', async () => {
    const cachedAvatar = 'ipfs://cached-avatar';
    const profile = await resolveEnsProfile('deanpierce.eth', resolver({
      getTextRecord: async () => {
        throw new Error('avatar provider failed');
      },
    }), { address: deanAddress, avatar: cachedAvatar });

    assert.equal(profile?.profile_data.ens_avatar, cachedAvatar);
  });

  it('does not carry an avatar across an address change', async () => {
    const changedAddress = '0x1111111111111111111111111111111111111111';
    const profile = await resolveEnsProfile('deanpierce.eth', resolver({
      getAddressRecord: async () => ({ value: changedAddress, id: 60 }),
      getTextRecord: async () => {
        throw new Error('avatar provider failed');
      },
    }), { address: deanAddress, avatar: 'ipfs://old-address-avatar' });

    assert.equal(profile?.address, changedAddress);
    assert.equal(profile?.profile_data.ens_avatar, null);
  });

  it('resolves directly when the cache database is unavailable', async () => {
    const handler = createHandler(unavailableDatabaseDependencies());
    const { req, res } = createMocks({
      method: 'GET',
      query: { ens_name: 'DEANPIERCE.ETH' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    assert.equal(res._getJSONData().ens_name, 'deanpierce.eth');
    assert.equal(res._getJSONData().address, deanAddress);
  });

  it('returns stale cache when an explicit refresh provider fails', async () => {
    let disconnected = false;
    const cachedPayload = {
      ens_name: 'deanpierce.eth',
      address: deanAddress,
      profile_data: { ens_avatar: null },
      last_sync_status: 'Previously updated',
    };
    const prisma = {
      cached_profiles: {
        findUnique: async () => ({
          profile_data: JSON.stringify(cachedPayload),
          updated_at: new Date(0),
          next_sync_due: new Date(0),
          last_sync_status: 'Previously updated',
        }),
      },
      $disconnect: async () => {
        disconnected = true;
      },
    } as unknown as PrismaClient;
    const handler = createHandler({
      ensClient: resolver({
        getAddressRecord: async () => {
          throw new Error('all providers failed');
        },
      }),
      getPrisma: () => prisma,
      withPrisma: (async () => {
        throw new Error('not expected');
      }) as never,
    });
    const { req, res } = createMocks({
      method: 'GET',
      query: { ens_name: 'deanpierce.eth', refresh: 'true' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 200);
    assert.equal(res._getJSONData().address, deanAddress);
    assert.equal(res._getJSONData().stale, true);
    assert.equal(disconnected, true);
  });

  it('removes stale cache when an explicit refresh confirms no address', async () => {
    let deletedName: string | undefined;
    const cachedPayload = {
      ens_name: 'deanpierce.eth',
      address: deanAddress,
      profile_data: { ens_avatar: null },
      last_sync_status: 'Previously updated',
    };
    const prisma = {
      cached_profiles: {
        findUnique: async () => ({
          profile_data: JSON.stringify(cachedPayload),
          updated_at: new Date(0),
          next_sync_due: new Date(0),
          last_sync_status: 'Previously updated',
        }),
        deleteMany: async ({ where }: { where: { ens_name: string } }) => {
          deletedName = where.ens_name;
          return { count: 1 };
        },
      },
      $disconnect: async () => undefined,
    } as unknown as PrismaClient;
    const handler = createHandler({
      ensClient: resolver({ getAddressRecord: async () => null }),
      getPrisma: () => prisma,
      withPrisma: (async () => {
        throw new Error('not expected');
      }) as never,
    });
    const { req, res } = createMocks({
      method: 'GET',
      query: { ens_name: 'deanpierce.eth', refresh: 'true' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 404);
    assert.equal(deletedName, 'deanpierce.eth');
  });

  it('rejects invalid ENS names before touching the database', async () => {
    const handler = createHandler(unavailableDatabaseDependencies());
    const { req, res } = createMocks({
      method: 'GET',
      query: { ens_name: 'not-an-ens-name' },
    });

    await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);

    assert.equal(res._getStatusCode(), 400);
  });
});
