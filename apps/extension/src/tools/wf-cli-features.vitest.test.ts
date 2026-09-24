import { describe, expect, it } from 'vitest';

import { WF_DOMAIN_FLAG_MIN_VERSION, WF_INDEXES_MIN_VERSION } from '@vnext-forge-studio/services-core';

import { WF_CLI_FEATURES, wfCliUpgradeMessage } from './wf-cli-features.js';

describe('WF_CLI_FEATURES', () => {
  it('takes every floor from services-core', () => {
    expect(WF_CLI_FEATURES.domainFlag.minVersion).toBe(WF_DOMAIN_FLAG_MIN_VERSION);
    expect(WF_CLI_FEATURES.indexes.minVersion).toBe(WF_INDEXES_MIN_VERSION);
  });
});

describe('wfCliUpgradeMessage', () => {
  it('names the feature, the installed version and the floor', () => {
    expect(wfCliUpgradeMessage('1.0.13', WF_CLI_FEATURES.indexes)).toBe(
      `Workflow CLI 1.0.13 does not support index SQL generation (wf indexes generate). ` +
        `Update to ${WF_INDEXES_MIN_VERSION} or newer.`,
    );
    expect(wfCliUpgradeMessage('1.0.12', WF_CLI_FEATURES.domainFlag)).toBe(
      'Workflow CLI 1.0.12 does not support the --domain option, so Forge is using the legacy ' +
        `"wf domain use <domain> && …" form. Update to ${WF_DOMAIN_FLAG_MIN_VERSION} or newer.`,
    );
  });

  it('handles an unknown version', () => {
    expect(wfCliUpgradeMessage(undefined, { featureName: 'X', minVersion: '9.9.9' })).toBe(
      'Workflow CLI (unknown version) does not support X. Update to 9.9.9 or newer.',
    );
  });
});
