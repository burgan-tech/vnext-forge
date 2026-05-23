/**
 * Bind path enumeration — thin re-export of the SDK helper.
 *
 * Prior to SDK v0.1.4 we had a local implementation here. The SDK now
 * ships a richer version (returns `BindPathEntry[]` with type / format /
 * label / hasLov / hasLookup / required / depth) that handles `allOf`
 * merging and respects schema-side x-* annotations. We keep this file
 * only as a stable internal import path — consumers don't need to know
 * the helper comes from the SDK.
 */

export { enumerateBindPaths } from '@burgantech/pseudo-ui';
export type { BindPathEntry, EnumerateOptions } from '@burgantech/pseudo-ui';
