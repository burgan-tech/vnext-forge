import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PSEUDO_UI_LANG,
  DEFAULT_PSEUDO_UI_TENANT_STYLE,
  useSettingsStore,
} from './useSettingsStore';

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

  it('normalizes pseudo-ui render language (R20)', () => {
    // Default is the platform's primary banking locale.
    expect(useSettingsStore.getState().pseudoUiLang).toBe(DEFAULT_PSEUDO_UI_LANG);

    // Accepts arbitrary ISO codes.
    useSettingsStore.getState().setPseudoUiLang('en');
    expect(useSettingsStore.getState().pseudoUiLang).toBe('en');

    useSettingsStore.getState().setPseudoUiLang('ar');
    expect(useSettingsStore.getState().pseudoUiLang).toBe('ar');

    // Trims whitespace.
    useSettingsStore.getState().setPseudoUiLang('  de  ');
    expect(useSettingsStore.getState().pseudoUiLang).toBe('de');

    // Empty / non-string falls back to default so the surface never
    // ends up passing an empty string to the SDK.
    useSettingsStore.getState().setPseudoUiLang('');
    expect(useSettingsStore.getState().pseudoUiLang).toBe(DEFAULT_PSEUDO_UI_LANG);

    useSettingsStore.getState().setPseudoUiLang('   ');
    expect(useSettingsStore.getState().pseudoUiLang).toBe(DEFAULT_PSEUDO_UI_LANG);
  });
});
