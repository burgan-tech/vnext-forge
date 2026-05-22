import { describe, expect, it } from 'vitest';

import {
  getPseudoUiTenantStyleHref,
  normalizePseudoUiTenantStyle,
} from './PseudoUiTenantStyleSync';

describe('PseudoUiTenantStyleSync', () => {
  it('normalizes injected tenant stylesheet settings', () => {
    expect(
      normalizePseudoUiTenantStyle({
        enabled: true,
        sourceType: 'localFile',
        value: 'vscode-resource://tenant.css',
      }),
    ).toEqual({
      enabled: true,
      sourceType: 'localFile',
      value: 'vscode-resource://tenant.css',
    });

    expect(normalizePseudoUiTenantStyle({ sourceType: 'unknown', value: 42 })).toEqual({
      enabled: false,
      sourceType: 'url',
      value: '',
    });
  });

  it('resolves tenant stylesheet href only when enabled and non-empty', () => {
    expect(
      getPseudoUiTenantStyleHref({
        enabled: true,
        sourceType: 'url',
        value: ' https://example.com/tenant.css ',
      }),
    ).toBe('https://example.com/tenant.css');

    expect(
      getPseudoUiTenantStyleHref({
        enabled: false,
        sourceType: 'url',
        value: 'https://example.com/tenant.css',
      }),
    ).toBeNull();
  });
});
