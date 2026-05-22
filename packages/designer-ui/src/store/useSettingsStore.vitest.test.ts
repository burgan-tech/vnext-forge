import { describe, expect, it } from 'vitest';

import { DEFAULT_PSEUDO_UI_TENANT_STYLE, useSettingsStore } from './useSettingsStore';

describe('useSettingsStore', () => {
  it('normalizes pseudo-ui tenant stylesheet settings', () => {
    useSettingsStore.getState().setPseudoUiTenantStyle({
      enabled: true,
      sourceType: 'localFile',
      value: '/tmp/tenant.css',
    });

    expect(useSettingsStore.getState().pseudoUiTenantStyle).toEqual({
      enabled: true,
      sourceType: 'localFile',
      value: '/tmp/tenant.css',
    });

    useSettingsStore.getState().setPseudoUiTenantStyle({
      sourceType: 'url',
      value: 'https://example.com/theme.css',
    });

    expect(useSettingsStore.getState().pseudoUiTenantStyle).toEqual({
      enabled: true,
      sourceType: 'url',
      value: 'https://example.com/theme.css',
    });

    useSettingsStore.getState().setPseudoUiTenantStyle(DEFAULT_PSEUDO_UI_TENANT_STYLE);
  });
});
