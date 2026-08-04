/**
 * Forward-port of the view `attributes.display` SDI/MDI shape onto schema
 * packages that predate it.
 *
 * ## Why this exists
 *
 * `vnext-schema` PR #128 (merged 2026-08-02) turned `attributes.display` into
 * `oneOf: [sdiDisplay, displayModes]`, so a view can declare its display per
 * client mode. No npm release carries it yet — 0.0.51 was published 2026-07-27
 * and is still the string-only enum with no `definitions` block — while Forge
 * pins `^0.0.39` and projects pin their own `schemaVersion`. Without this patch
 * the View editor would author `{ "sdi": …, "mdi": … }` and then Forge's own
 * validation would reject it with `must be string`.
 *
 * ## Why it is safe to delete later
 *
 * The patch is **shape-detected, not version-gated**: it fires only when the
 * resolved schema still has the old string-only `display`. The day a package
 * carrying #128 is published and a project pins it, this becomes a no-op for
 * that project, and the file can be removed outright once the pinned floor is
 * high enough everywhere.
 *
 * Scoped to the `display` node and the three `definitions` it needs, so any
 * other view-schema change in a newer published version still takes effect —
 * which vendoring the whole file would have blocked.
 *
 * Values copied verbatim from `vnext-schema/schemas/view-definition.schema.json`.
 */

/** The `display` node from the post-#128 schema. */
const DISPLAY_NODE: Readonly<Record<string, unknown>> = Object.freeze({
  description:
    'View display mode. String form declares the SDI (single-document) display and is the backward-compatible shape. Object form declares the display per client mode.',
  oneOf: [{ $ref: '#/definitions/sdiDisplay' }, { $ref: '#/definitions/displayModes' }],
})

/**
 * The display vocabulary, shared by both modes.
 *
 * SDI and MDI accept the same values — the mode selects which client interface
 * the value applies to, not which presentations exist. Both definitions below are
 * generated from this one array so they cannot drift apart.
 */
const DISPLAY_VALUES: readonly { const: string; description: string }[] = [
  { const: 'full-page', description: 'Full page display' },
  { const: 'popup', description: 'Popup/modal display' },
  { const: 'bottom-sheet', description: 'Bottom sheet display' },
  { const: 'top-sheet', description: 'Top sheet display' },
  { const: 'drawer', description: 'Drawer/side menu display' },
  { const: 'inline', description: 'Inline display within page' },
]

/** The three `definitions` the node above references. */
const DISPLAY_DEFINITIONS: Readonly<Record<string, unknown>> = Object.freeze({
  sdiDisplay: {
    type: 'string',
    description: 'Display mode for SDI (single-document interface) clients.',
    oneOf: DISPLAY_VALUES,
  },
  mdiDisplay: {
    type: 'string',
    description:
      'Display mode for MDI (multi-document interface) clients. Same vocabulary as sdiDisplay.',
    oneOf: DISPLAY_VALUES,
  },
  displayModes: {
    type: 'object',
    description: 'Per-mode display declaration. At least one of sdi or mdi must be present.',
    properties: {
      sdi: { $ref: '#/definitions/sdiDisplay' },
      mdi: { $ref: '#/definitions/mdiDisplay' },
    },
    anyOf: [{ required: ['sdi'] }, { required: ['mdi'] }],
    additionalProperties: false,
  },
})

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * True when `schema` is a view schema that still has the pre-#128 `display`.
 *
 * Both conditions matter. The `definitions.sdiDisplay` check alone would
 * re-patch a schema that renamed things; the `display.type === 'string'` check
 * alone would fire on a future schema that kept a string form for some other
 * reason. Requiring both means an unrecognised shape is left untouched, which is
 * the safe default for a patch that has to survive package upgrades.
 */
function needsDisplayPatch(schema: Record<string, unknown>): boolean {
  if (asRecord(schema.definitions)?.sdiDisplay !== undefined) return false

  const display = asRecord(asRecord(asRecord(schema.properties)?.attributes)?.properties)?.display
  return asRecord(display)?.type === 'string'
}

/**
 * Return `schema` with the SDI/MDI `display` shape applied, or `schema`
 * unchanged when it is not a stale view schema.
 *
 * Never mutates its input: the schema object belongs to the loaded
 * `@burgan-tech/vnext-schema` module, which `validate.service` caches and shares
 * across every version key, so mutating it would leak the patch into schemas it
 * was never meant to touch. Only the nodes on the path being replaced are
 * cloned — the rest of the schema is shared by reference, which keeps this cheap
 * enough to run on every schema read.
 */
export function patchViewDisplaySchema(
  type: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (type !== 'view') return schema
  if (!needsDisplayPatch(schema)) return schema

  const properties = asRecord(schema.properties)
  const attributes = asRecord(properties?.attributes)
  const attributeProperties = asRecord(attributes?.properties)
  // `needsDisplayPatch` already proved this path exists; the guard is here so a
  // future refactor of that predicate cannot turn into a runtime throw.
  if (!properties || !attributes || !attributeProperties) return schema

  return {
    ...schema,
    definitions: { ...asRecord(schema.definitions), ...DISPLAY_DEFINITIONS },
    properties: {
      ...properties,
      attributes: {
        ...attributes,
        properties: { ...attributeProperties, display: DISPLAY_NODE },
      },
    },
  }
}
