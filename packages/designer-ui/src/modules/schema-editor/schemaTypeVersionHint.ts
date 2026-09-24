/**
 * Published `@burgan-tech/vnext-schema` releases at or below `0.0.53` restrict
 * `attributes.type` to a fixed enum. Free text (including our `master`
 * default) arrived in 0.0.54. A project pinned to one of those older releases
 * fails both Forge's pinned-version validation and its own `npm run validate`
 * for any value outside the legacy enum, so the hint tells the user to upgrade.
 *
 * This module is a small pure helper (no I/O) so the version comparison and
 * message wording can be unit tested without rendering.
 */

/** `attributes.type` enum accepted by vnext-schema releases <= 0.0.53. */
export const LEGACY_SCHEMA_TYPE_ENUM = new Set([
  'workflow',
  'task',
  'function',
  'view',
  'schema',
  'extension',
  'headers',
]);

/** Last published release still restricted to {@link LEGACY_SCHEMA_TYPE_ENUM}. */
const LAST_LEGACY_ENUM_VERSION = '0.0.53';

/**
 * Compares two `major.minor.patch` version strings (a leading `v` and any
 * trailing pre-release/build metadata are ignored). Returns `null` when
 * either string does not start with a parseable `x.y.z`, so callers can tell
 * "older" apart from "unparseable" instead of miscomparing.
 */
export function compareSemverLike(a: string, b: string): number | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function parseVersion(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * True once the pinned `schemaVersion` is known to be newer than the last
 * legacy-enum release — i.e. free-text `attributes.type` values will pass
 * that project's own `npm run validate`. An unparseable or missing version
 * is treated conservatively as "still restricted".
 */
export function pinnedSchemaAllowsFreeTypeText(schemaVersion: string | undefined): boolean {
  if (!schemaVersion) return false;
  const cmp = compareSemverLike(schemaVersion, LAST_LEGACY_ENUM_VERSION);
  return cmp !== null && cmp > 0;
}

/**
 * Warning to show under `attributes.type` when the current value would fail
 * the project's own pinned vnext-schema validation, or `null` when the value
 * is in the legacy enum or the pinned schema is known to allow free text.
 */
export function schemaTypeVersionHint(value: string, schemaVersion: string | undefined): string | null {
  if (LEGACY_SCHEMA_TYPE_ENUM.has(value)) return null;
  if (pinnedSchemaAllowsFreeTypeText(schemaVersion)) return null;
  const label = schemaVersion && schemaVersion.trim() !== '' ? schemaVersion : 'an older vnext-schema';
  return (
    `Your pinned vnext-schema (${label}) only accepts workflow, task, function, view, schema, ` +
    'extension, headers — `npm run validate` will fail until you upgrade to a release that allows free-text types.'
  );
}
