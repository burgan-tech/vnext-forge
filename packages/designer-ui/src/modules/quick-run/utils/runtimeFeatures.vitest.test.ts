import { describe, expect, it } from 'vitest';
import { compareVersions, runtimeAtLeast } from '@vnext-forge-studio/vnext-types';

import { runtimeSupports } from './runtimeFeatures';

describe('runtime version gating', () => {
  it('treats an unknown version as undefined', () => {
    expect(runtimeAtLeast(null, '0.0.99')).toBeUndefined();
    expect(runtimeAtLeast('', '0.0.99')).toBeUndefined();
    expect(runtimeAtLeast('dev', '0.0.99')).toBeUndefined();
  });

  it('parses 4-part, v-prefixed and pre-release versions', () => {
    expect(runtimeAtLeast('0.0.99.0', '0.0.99')).toBe(true);
    expect(runtimeAtLeast('v0.0.100', '0.0.99')).toBe(true);
    expect(runtimeAtLeast('0.0.98', '0.0.99')).toBe(false);
    expect(compareVersions('0.0.55-local.1', '0.0.55')).toBe(0);
  });

  it('gates 0.0.99 surfaces', () => {
    expect(runtimeSupports('0.0.98', 'correlationTree')).toBe(false);
    expect(runtimeSupports('0.0.99', 'executionType')).toBe(true);
    expect(runtimeSupports(undefined, 'elementMetrics')).toBeUndefined();
  });
});
