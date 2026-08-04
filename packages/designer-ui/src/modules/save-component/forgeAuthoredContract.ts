/**
 * Component `attributes` properties whose editors Forge ships **ahead of the
 * `@burgan-tech/vnext-schema` release it bundles**.
 *
 * Forge's job is to offer the current contract: when the engine specifies a new
 * field, the designer gets an editor for it right away, and the editors render
 * it unconditionally. That has always been the practice here — `attributes.cache`
 * and `attributes.rawResponse` have had UI for months while living in no
 * published schema at all.
 *
 * The bundled schema therefore cannot answer "does Forge support this field?".
 * Forge's bundled pin is `^0.0.39` (published before `rawResponse`, `cache`, and
 * the whole function contract block existed), and new projects are even created
 * with `schemaVersion: '0.0.33'`. Asking a JSON file whether Forge supports a
 * field Forge's own source code implements is the wrong question — hence this
 * explicit list.
 *
 * What it is used for: `versionSkewErrors` treats an
 * `additionalProperties` violation for one of these as **version skew** rather
 * than a defect, so the save proceeds with a warning instead of leaving the user
 * with an unsaveable file.
 *
 * **Maintenance:** this is a shrinking list, not a growing one. When the bundled
 * `@burgan-tech/vnext-schema` pin is raised to a release that declares a
 * property, delete it from here — `versionSkewErrors` also consults the bundled
 * schema, so coverage is preserved automatically and nothing regresses.
 */
export const FORGE_AUTHORED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  function: [
    // Function contract declaration — schema commit 85efe58 (2026-08-03),
    // unpublished at the time this UI landed.
    'verbs',
    'inputSchema',
    'outputSchema',
    'inputView',
    'outputView',
    // Older additions that also postdate the bundled 0.0.39 release.
    'cache',
    'rawResponse',
  ],
};

/**
 * Does Forge itself author `property` under `attributes` for this component
 * type? `undefined` component types (callers where the type is optional) never
 * match.
 */
export function isForgeAuthoredAttribute(
  componentType: string | undefined,
  property: string,
): boolean {
  if (!componentType) return false;
  const authored = FORGE_AUTHORED_ATTRIBUTES[componentType];
  return authored ? authored.includes(property) : false;
}
