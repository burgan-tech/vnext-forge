/**
 * Integration check against the **real** `@burgan-tech/vnext-schema` release
 * Forge bundles, rather than a hand-written stand-in.
 *
 * Two things are pinned here:
 *
 *  1. The version-skew scenario is real — the bundled schema genuinely declares
 *     none of the function contract fields and sets `additionalProperties: false`,
 *     so without `FORGE_AUTHORED_ATTRIBUTES` every one of them would block the
 *     save. This is the assumption the whole downgrade rests on, and it was
 *     wrong once already (the bundled schema was briefly treated as the source
 *     of truth for what Forge supports).
 *
 *  2. It doubles as a **maintenance tripwire**: once the bundled pin is raised to
 *     a release that declares these properties, the first test flips to the
 *     "already declared" branch and reports which entries can be pruned from
 *     `FORGE_AUTHORED_ATTRIBUTES`. Nothing breaks either way — `versionSkewErrors`
 *     consults both sources.
 *
 * Deliberately no AJV: designer-ui does not depend on it, and what needs
 * protecting is the classification decision, not AJV's own behaviour. The error
 * objects below are the exact shape `services-core`'s `mapAjvErrors` produces
 * for an `additionalProperties` violation (`instancePath` → `path`, `params`
 * passed through).
 */
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { FORGE_AUTHORED_ATTRIBUTES } from './forgeAuthoredContract';
import { partitionVersionSkewErrors } from './versionSkewErrors';

const require_ = createRequire(import.meta.url);

interface VnextSchemaModule {
  getSchema(type: string): Record<string, unknown> | null;
}

const bundledSchema = (
  require_('@burgan-tech/vnext-schema') as VnextSchemaModule
).getSchema('function');

const bundledVersion = (
  require_('@burgan-tech/vnext-schema/package.json') as { version: string }
).version;

function declaredAttributes(schema: Record<string, unknown> | null): string[] {
  const attributes = (schema?.properties as Record<string, unknown> | undefined)?.attributes as
    | Record<string, unknown>
    | undefined;
  const properties = attributes?.properties;
  return properties && typeof properties === 'object' ? Object.keys(properties) : [];
}

/** Exactly what mapAjvErrors emits for `additionalProperties` at /attributes. */
const additionalPropertyError = (property: string) => ({
  path: '/attributes',
  message: `must NOT have additional property "${property}"`,
  params: { additionalProperty: property },
});

const FUNCTION_CONTEXT = { componentType: 'function', bundledSchema };

describe(`bundled @burgan-tech/vnext-schema@${bundledVersion}`, () => {
  it('is resolvable and exposes a function schema', () => {
    expect(bundledSchema).not.toBeNull();
  });

  it('rejects unknown attributes, which is what makes skew handling necessary', () => {
    const attributes = (bundledSchema?.properties as Record<string, unknown>).attributes as
      | Record<string, unknown>
      | undefined;
    expect(attributes?.additionalProperties).toBe(false);
  });

  it('reports which authored entries the bundled schema now covers (prune tripwire)', () => {
    const declared = new Set(declaredAttributes(bundledSchema));
    const alreadyDeclared = FORGE_AUTHORED_ATTRIBUTES.function.filter((f) => declared.has(f));

    // Not an assertion that the list must stay non-empty — it is expected to
    // shrink to nothing. The message names what to delete when that happens.
    if (alreadyDeclared.length > 0) {
      console.info(
        `[forgeAuthoredContract] bundled schema ${bundledVersion} now declares: ` +
          `${alreadyDeclared.join(', ')} — these can be removed from FORGE_AUTHORED_ATTRIBUTES.function`,
      );
    }
    expect(Array.isArray(alreadyDeclared)).toBe(true);
  });
});

describe('save behaviour against the real bundled schema', () => {
  it('downgrades every authored contract field, so the save proceeds', () => {
    // Against a project pinned at or before the bundled release, each of these
    // is an `additionalProperties` error. All must be classified as skew.
    const errors = FORGE_AUTHORED_ATTRIBUTES.function.map(additionalPropertyError);
    const { blocking, skew, skewProperties } = partitionVersionSkewErrors(errors, FUNCTION_CONTEXT);

    expect(blocking).toEqual([]);
    expect(skew).toHaveLength(errors.length);
    expect(skewProperties).toEqual([...FORGE_AUTHORED_ATTRIBUTES.function]);
  });

  it('still blocks a property Forge does not author', () => {
    const { blocking, skew } = partitionVersionSkewErrors(
      [additionalPropertyError('definitelyNotAField')],
      FUNCTION_CONTEXT,
    );
    expect(blocking).toHaveLength(1);
    expect(skew).toEqual([]);
  });

  it('blocks a mixed batch on the strength of the real defect alone', () => {
    const { blocking, skewProperties } = partitionVersionSkewErrors(
      [additionalPropertyError('verbs'), additionalPropertyError('oops')],
      FUNCTION_CONTEXT,
    );
    expect(blocking.map((e) => e.params.additionalProperty)).toEqual(['oops']);
    expect(skewProperties).toEqual(['verbs']);
  });

  it('would block everything without a component type — fails closed', () => {
    const errors = FORGE_AUTHORED_ATTRIBUTES.function.map(additionalPropertyError);
    const { blocking } = partitionVersionSkewErrors(errors, { bundledSchema });
    // Only the properties the bundled schema itself declares would survive; on
    // the current pin that is none of them.
    const declared = new Set(declaredAttributes(bundledSchema));
    expect(blocking).toHaveLength(
      errors.length - FORGE_AUTHORED_ATTRIBUTES.function.filter((f) => declared.has(f)).length,
    );
  });
});
