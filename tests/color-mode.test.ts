import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COLOR_MODE_STORAGE_KEY, getToggleTargetColorMode } from '../src/lib/colorMode';

describe('color mode', () => {
  it('uses a namespaced persistence key', () => {
    assert.equal(COLOR_MODE_STORAGE_KEY, 'crypto-me-color-mode');
  });

  it('switches between the two resolved color modes', () => {
    assert.equal(getToggleTargetColorMode('light'), 'dark');
    assert.equal(getToggleTargetColorMode('dark'), 'light');
    assert.equal(getToggleTargetColorMode(undefined), 'dark');
  });
});
