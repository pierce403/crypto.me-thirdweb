import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRetryableResource, withTimeout } from '../src/async.mjs';
import { collectXmtpProfile, isEthereumAddress } from '../src/profile.mjs';

const viewedAddress = '0x1111111111111111111111111111111111111111';
const recoveryAddress = '0x2222222222222222222222222222222222222222';

describe('XMTP collector profile', () => {
  it('bounds backend initialization and permits a clean retry after timeout', async () => {
    let resolveFirstAttempt;
    let attempts = 0;
    const backend = createRetryableResource(() => {
      attempts += 1;
      if (attempts === 1) {
        return new Promise((resolve) => {
          resolveFirstAttempt = resolve;
        });
      }
      return Promise.resolve('ready');
    });

    const firstAttempt = backend.get();
    await assert.rejects(
      withTimeout(firstAttempt, 10, () => backend.invalidate(firstAttempt)),
      /timed out after 10ms/,
    );

    const secondAttempt = backend.get();
    assert.notEqual(secondAttempt, firstAttempt);
    assert.equal(await secondAttempt, 'ready');
    assert.equal(attempts, 2);

    resolveFirstAttempt('late result');
    assert.equal(await backend.get(), 'ready');
  });

  it('validates Ethereum addresses exactly', () => {
    assert.equal(isEthereumAddress(viewedAddress), true);
    assert.equal(isEthereumAddress(`${viewedAddress}00`), false);
    assert.equal(isEthereumAddress('demo.eth'), false);
  });

  it('returns every inbox identity and safe properties', async () => {
    const payload = await collectXmtpProfile(viewedAddress, {
      ethereumIdentifierKind: 0,
      lookupInboxId: async () => 'inbox-123',
      fetchInboxStates: async () => [{
        inboxId: 'inbox-123',
        recoveryIdentifier: { identifier: recoveryAddress, identifierKind: 0 },
        identifiers: [
          { identifier: viewedAddress.toUpperCase().replace('0X', '0x'), identifierKind: 0 },
          { identifier: recoveryAddress, identifierKind: 0 },
          { identifier: 'passkey-1', identifierKind: 1 },
          { identifier: 'future-identity', identifierKind: 99 },
        ],
        installations: [{ id: 'one' }, { id: 'two' }],
      }],
    });

    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.registered, true);
    assert.equal(payload.identities.length, 4);
    assert.equal(payload.identities[0].isViewedProfile, true);
    assert.equal(payload.identities[1].isRecovery, true);
    assert.equal(payload.identities[2].kind, 'passkey');
    assert.equal(payload.identities[3].kind, 'unknown');
    assert.equal(payload.connectedIdentities.length, 3);
    assert.equal(payload.installationCount, 2);
    assert.equal('installations' in payload, false);
  });

  it('returns a complete unregistered payload without fetching state', async () => {
    let fetchedState = false;
    const payload = await collectXmtpProfile(viewedAddress, {
      ethereumIdentifierKind: 0,
      lookupInboxId: async () => null,
      fetchInboxStates: async () => {
        fetchedState = true;
        return [];
      },
    });

    assert.equal(fetchedState, false);
    assert.equal(payload.registered, false);
    assert.equal(payload.inboxId, null);
    assert.deepEqual(payload.identities, []);
    assert.equal(payload.installationCount, 0);
  });

  it('rejects incomplete state instead of emitting cacheable partial data', async () => {
    await assert.rejects(
      collectXmtpProfile(viewedAddress, {
        ethereumIdentifierKind: 0,
        lookupInboxId: async () => 'inbox-123',
        fetchInboxStates: async () => [],
      }),
      /returned no state/,
    );
  });
});
