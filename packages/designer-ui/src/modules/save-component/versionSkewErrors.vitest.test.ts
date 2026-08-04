/**
 * These tests guard the boundary between "the project's pin is behind" and
 * "this document is wrong". Getting it wrong in one direction makes files
 * unsaveable; getting it wrong in the other lets real typos through the save
 * gate silently. Both failure modes are near-invisible in manual testing, hence
 * the exhaustive cases here.
 */
import { describe, expect, it } from 'vitest';

import { FORGE_AUTHORED_ATTRIBUTES, isForgeAuthoredAttribute } from './forgeAuthoredContract';
import {
  isVersionSkewError,
  partitionVersionSkewErrors,
  resolveSchemaAtInstancePath,
} from './versionSkewErrors';

/**
 * A bundled schema that does NOT declare the function contract fields — this
 * mirrors reality, where Forge pins `^0.0.39` and that release predates them.
 */
const BUNDLED = {
  properties: {
    attributes: {
      properties: {
        scope: {},
        task: {},
        onExecutionTasks: {
          items: {
            properties: { order: {}, task: {}, mapping: {} },
          },
        },
      },
    },
  },
};

const additionalProperty = (path: string, property: string) => ({
  path,
  message: `must NOT have additional property "${property}"`,
  params: { additionalProperty: property },
});

const FN = { componentType: 'function', bundledSchema: BUNDLED };

describe('isVersionSkewError — Forge-authored properties', () => {
  it('classifies fields Forge authors ahead of its bundled schema as skew', () => {
    // This is the load-bearing case: the bundled schema knows none of these,
    // so without the authored list every one of them would block the save.
    for (const property of ['verbs', 'inputSchema', 'outputSchema', 'inputView', 'outputView']) {
      expect(isVersionSkewError(additionalProperty('/attributes', property), FN)).toBe(true);
    }
  });

  it('covers the older cache / rawResponse additions too', () => {
    // These have had unconditional UI for months while living in no published
    // schema, and were silently unsaveable on an older pin.
    expect(isVersionSkewError(additionalProperty('/attributes', 'cache'), FN)).toBe(true);
    expect(isVersionSkewError(additionalProperty('/attributes', 'rawResponse'), FN)).toBe(true);
  });

  it('does NOT classify a property Forge does not author — that is a real defect', () => {
    expect(isVersionSkewError(additionalProperty('/attributes', 'verbz'), FN)).toBe(false);
    expect(isVersionSkewError(additionalProperty('/attributes', 'nonsense'), FN)).toBe(false);
  });

  it('scopes the authored list to /attributes, not any depth', () => {
    expect(isVersionSkewError(additionalProperty('', 'verbs'), FN)).toBe(false);
    expect(
      isVersionSkewError(additionalProperty('/attributes/onExecutionTasks/0', 'verbs'), FN),
    ).toBe(false);
  });

  it('does not apply one component type’s authored list to another', () => {
    expect(
      isVersionSkewError(additionalProperty('/attributes', 'verbs'), {
        componentType: 'task',
        bundledSchema: BUNDLED,
      }),
    ).toBe(false);
  });

  it('needs a component type to consult the authored list', () => {
    expect(
      isVersionSkewError(additionalProperty('/attributes', 'verbs'), { bundledSchema: BUNDLED }),
    ).toBe(false);
  });

  it('works from the authored list alone, with no bundled schema at all', () => {
    // Offline, or before validate/getSchema resolves.
    expect(
      isVersionSkewError(additionalProperty('/attributes', 'verbs'), { componentType: 'function' }),
    ).toBe(true);
  });
});

describe('isVersionSkewError — bundled schema fallback', () => {
  it('classifies a property the bundled schema declares, at any depth', () => {
    // Keeps working once the pin is raised and entries leave the authored list,
    // and generalizes to component types with no authored list.
    expect(isVersionSkewError(additionalProperty('/attributes', 'scope'), FN)).toBe(true);
    expect(
      isVersionSkewError(additionalProperty('/attributes/onExecutionTasks/2', 'mapping'), FN),
    ).toBe(true);
  });

  it('respects nesting — a property is not excused at the wrong level', () => {
    expect(isVersionSkewError(additionalProperty('', 'scope'), FN)).toBe(false);
    expect(
      isVersionSkewError(additionalProperty('/attributes/onExecutionTasks/0', 'scope'), FN),
    ).toBe(false);
  });

  it('fails closed with neither authored list nor bundled schema', () => {
    expect(isVersionSkewError(additionalProperty('/attributes', 'scope'), {})).toBe(false);
    expect(
      isVersionSkewError(additionalProperty('/attributes', 'scope'), { bundledSchema: null }),
    ).toBe(false);
  });

  it('fails closed on a path the bundled schema cannot resolve', () => {
    expect(isVersionSkewError(additionalProperty('/unknown/deep', 'scope'), FN)).toBe(false);
  });
});

describe('isVersionSkewError — only additionalProperties errors', () => {
  it('never downgrades a missing required property', () => {
    expect(
      isVersionSkewError(
        {
          path: '/attributes',
          message: 'must have required property "scope"',
          params: { missingProperty: 'scope' },
        },
        FN,
      ),
    ).toBe(false);
  });

  it('never downgrades a type error', () => {
    expect(isVersionSkewError({ path: '/key', message: 'must be string' }, FN)).toBe(false);
  });

  it('ignores a malformed or absent additionalProperty param', () => {
    expect(isVersionSkewError({ path: '/attributes', message: 'x' }, FN)).toBe(false);
    expect(
      isVersionSkewError(
        { path: '/attributes', message: 'x', params: { additionalProperty: '' } },
        FN,
      ),
    ).toBe(false);
    expect(
      isVersionSkewError(
        { path: '/attributes', message: 'x', params: { additionalProperty: 42 } },
        FN,
      ),
    ).toBe(false);
  });
});

describe('resolveSchemaAtInstancePath', () => {
  it('returns the root for an empty path', () => {
    expect(resolveSchemaAtInstancePath(BUNDLED, '')).toBe(BUNDLED);
  });

  it('walks object properties', () => {
    expect(resolveSchemaAtInstancePath(BUNDLED, '/attributes')).toBe(BUNDLED.properties.attributes);
  });

  it('walks array items via a numeric segment', () => {
    expect(resolveSchemaAtInstancePath(BUNDLED, '/attributes/onExecutionTasks/0')).toBe(
      BUNDLED.properties.attributes.properties.onExecutionTasks.items,
    );
  });

  it('unescapes RFC 6901 tokens', () => {
    const schema = { properties: { 'a/b': { properties: { 'c~d': { leaf: true } } } } };
    expect(resolveSchemaAtInstancePath(schema, '/a~1b/c~0d')).toEqual({ leaf: true });
  });

  it('returns null for an unresolvable path rather than guessing', () => {
    expect(resolveSchemaAtInstancePath(BUNDLED, '/nope')).toBeNull();
    expect(resolveSchemaAtInstancePath(BUNDLED, '/attributes/scope/deeper')).toBeNull();
    expect(resolveSchemaAtInstancePath(null, '/attributes')).toBeNull();
  });
});

describe('partitionVersionSkewErrors', () => {
  it('separates skew from blocking errors and lists the skewed properties', () => {
    const result = partitionVersionSkewErrors(
      [
        additionalProperty('/attributes', 'verbs'),
        additionalProperty('/attributes', 'inputView'),
        { path: '/key', message: 'must match pattern' },
      ],
      FN,
    );
    expect(result.skew).toHaveLength(2);
    expect(result.blocking).toHaveLength(1);
    expect(result.skewProperties).toEqual(['verbs', 'inputView']);
  });

  it('de-duplicates repeated properties in first-seen order', () => {
    const result = partitionVersionSkewErrors(
      [
        additionalProperty('/attributes', 'inputView'),
        additionalProperty('/attributes', 'verbs'),
        additionalProperty('/attributes', 'inputView'),
      ],
      FN,
    );
    expect(result.skewProperties).toEqual(['inputView', 'verbs']);
  });

  it('keeps a real defect blocking even when skew errors accompany it', () => {
    // The whole point: one genuine problem must not be waved through just
    // because the same save also carried version-skew noise.
    const result = partitionVersionSkewErrors(
      [additionalProperty('/attributes', 'verbs'), additionalProperty('/attributes', 'typo')],
      FN,
    );
    expect(result.blocking.map((e) => e.params?.additionalProperty)).toEqual(['typo']);
    expect(result.skew).toHaveLength(1);
  });

  it('treats everything as blocking with no context at all', () => {
    const errors = [additionalProperty('/attributes', 'verbs')];
    const result = partitionVersionSkewErrors(errors, {});
    expect(result.blocking).toEqual(errors);
    expect(result.skew).toEqual([]);
    expect(result.skewProperties).toEqual([]);
  });

  it('handles an empty error list', () => {
    expect(partitionVersionSkewErrors([], FN)).toEqual({
      blocking: [],
      skew: [],
      skewProperties: [],
    });
  });
});

describe('FORGE_AUTHORED_ATTRIBUTES', () => {
  it('covers every contract field the function editor writes', () => {
    // Guards against adding a field to the editor and forgetting it here,
    // which would make that field silently unsaveable on an older pin.
    expect(FORGE_AUTHORED_ATTRIBUTES.function).toEqual(
      expect.arrayContaining([
        'verbs',
        'inputSchema',
        'outputSchema',
        'inputView',
        'outputView',
        'cache',
        'rawResponse',
      ]),
    );
  });

  it('returns false for unknown component types and properties', () => {
    expect(isForgeAuthoredAttribute(undefined, 'verbs')).toBe(false);
    expect(isForgeAuthoredAttribute('workflow', 'verbs')).toBe(false);
    expect(isForgeAuthoredAttribute('function', 'scope')).toBe(false);
  });
});
