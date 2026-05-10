/**
 * Field extension registry.
 *
 * The built-in `SchemaField` renderer covers the JSON Schema subset we
 * use today (strings, numbers, booleans, objects, arrays, enums, oneOf).
 * For Burgan-specific annotations like `x-localization` and
 * `x-remote-service`, host shells register **field extensions** here.
 * Each extension can:
 *   - declare which schema properties it claims (`match`)
 *   - render a custom widget (`render`)
 *   - intercept the label / description (`decorate`)
 *
 * Today the registry ships with stub plugins (no-op decorators) so the
 * extension surface is stable and host shells can swap them in without
 * touching the core renderer. When a real localization table or remote
 * service catalog lands, only the plugin needs to change.
 */
import type { ReactNode } from 'react';
import type { JsonSchemaProperty, SchemaFieldContext } from './types';

export interface FieldExtensionRenderArgs {
  prop: JsonSchemaProperty;
  value: unknown;
  onChange: (next: unknown) => void;
  context: SchemaFieldContext;
}

export interface FieldExtensionDecorateArgs {
  prop: JsonSchemaProperty;
  label: string;
  description?: string;
}

export interface FieldExtension {
  /** Stable id for debugging / dedupe. */
  id: string;
  /**
   * Returns `true` if this extension should claim the property — gets
   * priority over the built-in renderer. The first matching extension
   * (in registration order) wins.
   */
  match(prop: JsonSchemaProperty): boolean;
  /**
   * Render a custom widget for this property. When provided this
   * REPLACES the built-in field control (label + value editor).
   */
  render?(args: FieldExtensionRenderArgs): ReactNode;
  /**
   * Adjust the label / description before the built-in renderer uses
   * them. Useful for `x-localization` plugins that swap a key for the
   * translated string. Returning `undefined` keeps the originals.
   */
  decorate?(args: FieldExtensionDecorateArgs): {
    label?: string;
    description?: string;
  } | undefined;
}

const registry: FieldExtension[] = [];

export function registerFieldExtension(ext: FieldExtension): void {
  // Drop any existing extension with the same id so registrations stay
  // idempotent across HMR / repeat boots.
  const existingIdx = registry.findIndex((e) => e.id === ext.id);
  if (existingIdx >= 0) registry.splice(existingIdx, 1);
  registry.push(ext);
}

export function clearFieldExtensions(): void {
  registry.length = 0;
}

export function getFieldExtensions(): ReadonlyArray<FieldExtension> {
  return registry;
}

export function findMatchingExtension(
  prop: JsonSchemaProperty,
): FieldExtension | undefined {
  for (const ext of registry) {
    try {
      if (ext.match(prop)) return ext;
    } catch {
      // Defensive: a buggy extension must never crash the form.
      continue;
    }
  }
  return undefined;
}

export function decorateLabel(
  prop: JsonSchemaProperty,
  fallbackLabel: string,
  fallbackDescription?: string,
): { label: string; description?: string } {
  let label = fallbackLabel;
  let description = fallbackDescription;
  for (const ext of registry) {
    if (!ext.decorate) continue;
    try {
      const result = ext.decorate({ prop, label, description });
      if (result?.label !== undefined) label = result.label;
      if (result?.description !== undefined) description = result.description;
    } catch {
      continue;
    }
  }
  return { label, ...(description !== undefined ? { description } : {}) };
}

// ── Built-in stub plugins ───────────────────────────────────────────────────
// These ship with the package so the extension surface is exercised from day
// one. Real implementations land later, and we only have to swap the plugin
// body — the surface stays stable.

/**
 * Stub for `x-localization`. Today it just appends a `(i18n: <key>)` hint
 * to the description so it's visible in the UI. When a real i18n table
 * lands, swap this body to look the key up.
 */
export const localizationStubExtension: FieldExtension = {
  id: 'builtin/x-localization',
  match: () => false, // never claims the field; only decorates
  decorate: ({ prop, label, description }) => {
    const annotation = prop['x-localization'];
    if (!annotation || typeof annotation !== 'object') return undefined;
    const key = (annotation as { key?: string }).key;
    if (!key) return undefined;
    return {
      label,
      description: description
        ? `${description} · i18n: ${key}`
        : `i18n: ${key}`,
    };
  },
};

/**
 * Stub for `x-remote-service`. Today it just decorates the description
 * with the upstream URL so users can tell a field expects values from a
 * remote enum. Real fetch + caching plugs into `render` later.
 */
export const remoteServiceStubExtension: FieldExtension = {
  id: 'builtin/x-remote-service',
  match: () => false,
  decorate: ({ prop, label, description }) => {
    const annotation = prop['x-remote-service'];
    if (!annotation || typeof annotation !== 'object') return undefined;
    const url = (annotation as { url?: string }).url;
    if (!url) return undefined;
    return {
      label,
      description: description
        ? `${description} · remote: ${url}`
        : `remote: ${url}`,
    };
  },
};

/** Register the built-in stubs once at module load. */
registerFieldExtension(localizationStubExtension);
registerFieldExtension(remoteServiceStubExtension);
