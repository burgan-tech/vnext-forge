import { describe, expect, it } from 'vitest';

import {
  compareSemverLike,
  pinnedSchemaAllowsFreeTypeText,
  schemaTypeVersionHint,
} from './schemaTypeVersionHint';

describe('compareSemverLike', () => {
  it('orders major/minor/patch numerically', () => {
    expect(compareSemverLike('0.0.53', '0.0.53')).toBe(0);
    expect(compareSemverLike('0.0.54', '0.0.53')).toBeGreaterThan(0);
    expect(compareSemverLike('0.0.52', '0.0.53')).toBeLessThan(0);
    expect(compareSemverLike('0.1.0', '0.0.99')).toBeGreaterThan(0);
    expect(compareSemverLike('1.0.0', '0.99.99')).toBeGreaterThan(0);
  });

  it('tolerates a leading v and trailing pre-release/build metadata', () => {
    expect(compareSemverLike('v0.0.60', '0.0.53')).toBeGreaterThan(0);
    expect(compareSemverLike('0.0.60-beta.1', '0.0.53')).toBeGreaterThan(0);
  });

  it('returns null for unparseable input', () => {
    expect(compareSemverLike('latest', '0.0.53')).toBeNull();
    expect(compareSemverLike('0.0.53', '')).toBeNull();
  });
});

describe('pinnedSchemaAllowsFreeTypeText', () => {
  it('is false when the version is missing or unparseable', () => {
    expect(pinnedSchemaAllowsFreeTypeText(undefined)).toBe(false);
    expect(pinnedSchemaAllowsFreeTypeText('')).toBe(false);
    expect(pinnedSchemaAllowsFreeTypeText('workspace')).toBe(false);
  });

  it('is false at or below 0.0.53', () => {
    expect(pinnedSchemaAllowsFreeTypeText('0.0.53')).toBe(false);
    expect(pinnedSchemaAllowsFreeTypeText('0.0.10')).toBe(false);
  });

  it('is true above 0.0.53', () => {
    expect(pinnedSchemaAllowsFreeTypeText('0.0.54')).toBe(true);
    expect(pinnedSchemaAllowsFreeTypeText('0.1.0')).toBe(true);
    expect(pinnedSchemaAllowsFreeTypeText('1.0.0')).toBe(true);
  });
});

describe('schemaTypeVersionHint', () => {
  it('is null for a legacy-enum value regardless of version', () => {
    expect(schemaTypeVersionHint('workflow', undefined)).toBeNull();
    expect(schemaTypeVersionHint('headers', '0.0.10')).toBeNull();
  });

  it('is null for free text once the pinned version allows it', () => {
    expect(schemaTypeVersionHint('master', '0.0.54')).toBeNull();
  });

  it('warns with the pinned version for free text on an old pin', () => {
    const msg = schemaTypeVersionHint('master', '0.0.53');
    expect(msg).toContain('0.0.53');
    expect(msg).toContain('npm run validate');
    expect(msg).toContain('workflow, task, function, view, schema, extension, headers');
  });

  it('says "an older vnext-schema" when the pinned version is unknown', () => {
    const msg = schemaTypeVersionHint('master', undefined);
    expect(msg).toContain('an older vnext-schema');
  });
});
