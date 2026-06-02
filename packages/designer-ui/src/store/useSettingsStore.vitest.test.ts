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

    // Reset for downstream tests.
    useSettingsStore.setState({
      pseudoUiLang: DEFAULT_PSEUDO_UI_LANG,
      pseudoUiCustomLangs: [],
    });
  });

  it('persists custom pseudo-ui languages alongside the built-in chips (R20.3)', () => {
    // Fresh state — built-ins implicit, no customs tracked yet.
    useSettingsStore.setState({
      pseudoUiLang: DEFAULT_PSEUDO_UI_LANG,
      pseudoUiCustomLangs: [],
    });

    // Adding a custom lang appends to the list (de-duped, trimmed).
    useSettingsStore.getState().addPseudoUiCustomLang('  ar  ');
    useSettingsStore.getState().addPseudoUiCustomLang('ar');
    useSettingsStore.getState().addPseudoUiCustomLang('de');
    expect(useSettingsStore.getState().pseudoUiCustomLangs).toEqual(['ar', 'de']);

    // Built-ins never land in the custom list.
    useSettingsStore.getState().addPseudoUiCustomLang('tr');
    useSettingsStore.getState().addPseudoUiCustomLang('en');
    expect(useSettingsStore.getState().pseudoUiCustomLangs).toEqual(['ar', 'de']);

    // setPseudoUiLang with a non-built-in code auto-tracks it.
    useSettingsStore.getState().setPseudoUiLang('th');
    expect(useSettingsStore.getState().pseudoUiLang).toBe('th');
    expect(useSettingsStore.getState().pseudoUiCustomLangs).toEqual(['ar', 'de', 'th']);

    // setPseudoUiLang with a built-in keeps customs intact (the bug
    // that motivated this round — switching back to TR / EN must
    // *not* clear the user's added languages).
    useSettingsStore.getState().setPseudoUiLang('tr');
    expect(useSettingsStore.getState().pseudoUiLang).toBe('tr');
    expect(useSettingsStore.getState().pseudoUiCustomLangs).toEqual(['ar', 'de', 'th']);

    // Removing a custom lang drops it; removing the active one
    // falls back to the default.
    useSettingsStore.getState().setPseudoUiLang('th');
    useSettingsStore.getState().removePseudoUiCustomLang('th');
    expect(useSettingsStore.getState().pseudoUiCustomLangs).toEqual(['ar', 'de']);
    expect(useSettingsStore.getState().pseudoUiLang).toBe(DEFAULT_PSEUDO_UI_LANG);

    // Removing a non-active custom lang leaves the active one alone.
    useSettingsStore.getState().setPseudoUiLang('tr');
    useSettingsStore.getState().removePseudoUiCustomLang('ar');
    expect(useSettingsStore.getState().pseudoUiCustomLangs).toEqual(['de']);
    expect(useSettingsStore.getState().pseudoUiLang).toBe('tr');

    // Reset.
    useSettingsStore.setState({
      pseudoUiLang: DEFAULT_PSEUDO_UI_LANG,
      pseudoUiCustomLangs: [],
    });
  });
});
