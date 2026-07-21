import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getEthereumExplorerUrl,
  getXmtpIdentities,
  getXmtpMessageUrl,
} from '../src/lib/xmtpProfile';

const viewedAddress = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa';
const recoveryAddress = '0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb';

describe('XMTP profile presentation', () => {
  it('builds message and explorer links only for Ethereum addresses', () => {
    assert.equal(getXmtpMessageUrl(viewedAddress, 'production'), `https://xmtp.im/${viewedAddress}`);
    assert.equal(
      getEthereumExplorerUrl(recoveryAddress),
      `https://etherscan.io/address/${recoveryAddress}`,
    );
    assert.equal(getXmtpMessageUrl('not-an-address', 'production'), null);
    assert.equal(getXmtpMessageUrl(viewedAddress, 'dev'), null);
    assert.equal(getXmtpMessageUrl(viewedAddress, null), null);
    assert.equal(getEthereumExplorerUrl('passkey-public-key'), null);
  });

  it('enumerates every canonical inbox identity with derived properties', () => {
    const identities = getXmtpIdentities({
      inboxId: 'inbox-123',
      recoveryIdentifier: { identifier: recoveryAddress.toUpperCase().replace('0X', '0x'), kind: 'ethereum' },
      identities: [
        { identifier: viewedAddress.toUpperCase().replace('0X', '0x'), kind: 'ethereum' },
        { identifier: recoveryAddress, kind: 'ethereum' },
        { identifier: 'passkey-1', kind: 'passkey' },
        { identifier: 'passkey-2', kind: 'passkey' },
        { identifier: 'future-identity', kind: 'future-kind' },
        { identifier: 'passkey-3', identifierKind: 1 },
      ],
    }, viewedAddress);

    assert.equal(identities.length, 6);
    assert.equal(identities[0].isViewedProfile, true);
    assert.equal(identities[0].explorerUrl, `https://etherscan.io/address/${identities[0].identifier}`);
    assert.equal(identities[1].isRecovery, true);
    assert.equal(identities[2].kind, 'passkey');
    assert.equal(identities[2].explorerUrl, null);
    assert.equal(identities[4].kind, 'unknown');
  });

  it('supports old cached connected-identity payloads without truncating or duplicating', () => {
    const identities = getXmtpIdentities({
      inboxId: 'inbox-123',
      identities: [null, {}],
      connectedIdentities: [
        { identifier: recoveryAddress, kind: 'ethereum' },
        { identifier: recoveryAddress.toUpperCase().replace('0X', '0x'), kind: 'ethereum' },
        { identifier: 'passkey-1', kind: 'passkey' },
      ],
    }, viewedAddress);

    assert.deepEqual(
      identities.map((identity) => identity.identifier),
      [viewedAddress, recoveryAddress, 'passkey-1'],
    );
  });
});
