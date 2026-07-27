import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasOutdatedServicePayload } from '../src/lib/cacheStore';

describe('service payload schemas', () => {
  it('refreshes legacy OpenSea payloads once without invalidating other services', () => {
    assert.equal(hasOutdatedServicePayload('opensea', { source: 'opensea' }), true);
    assert.equal(hasOutdatedServicePayload('opensea', { schemaVersion: 1 }), true);
    assert.equal(hasOutdatedServicePayload('opensea', { schemaVersion: 2 }), false);
    assert.equal(hasOutdatedServicePayload('alchemy', { source: 'alchemy' }), false);
  });
});
