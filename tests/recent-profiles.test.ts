import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolvedRecentProfileNames } from '../src/pages/api/recent-profiles';

const resolvedAddress = '0x7ab874Eeef0169ADA0d225E9801A3FfFfa26aAC3';

describe('recent profiles', () => {
  it('returns only normalized ENS names with a resolved Ethereum address', () => {
    const names = resolvedRecentProfileNames([
      {
        ens_name: 'DEANPIERCE.ETH',
        profile_data: JSON.stringify({ address: resolvedAddress }),
      },
      {
        ens_name: 'unresolved.eth',
        profile_data: JSON.stringify({ address: null }),
      },
      {
        ens_name: 'shellv3.php',
        profile_data: JSON.stringify({ address: 'Address not found' }),
      },
      {
        ens_name: 'zero.eth',
        profile_data: JSON.stringify({ address: '0x0000000000000000000000000000000000000000' }),
      },
      {
        ens_name: 'broken.eth',
        profile_data: '{not-json',
      },
      {
        ens_name: 'not-an-ens-name',
        profile_data: JSON.stringify({ address: resolvedAddress }),
      },
    ]);

    assert.deepEqual(names, ['deanpierce.eth']);
  });

  it('deduplicates normalized names and respects the result limit', () => {
    const profileData = JSON.stringify({ address: resolvedAddress });
    const names = resolvedRecentProfileNames([
      { ens_name: 'DEANPIERCE.ETH', profile_data: profileData },
      { ens_name: 'deanpierce.eth', profile_data: profileData },
      { ens_name: 'vitalik.eth', profile_data: profileData },
    ], 1);

    assert.deepEqual(names, ['deanpierce.eth']);
    assert.deepEqual(resolvedRecentProfileNames([
      { ens_name: 'deanpierce.eth', profile_data: profileData },
    ], 0), []);
  });
});
