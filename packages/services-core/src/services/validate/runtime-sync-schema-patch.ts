/**
 * Forward-port of unreleased vnext-schema changes (master `ac42026`, after
 * `v0.0.53`) that the September 2026 runtime already relies on:
 *
 * - workflow-definition: timeout annotations, expanded `subFlow.overrides`
 *   (long-poll window/roles, scoped view swaps), `longPoll` roles/rule `oneOf`,
 *   nullable `availableIn` for every trigger type.
 * - schema-definition: free-text `attributes.type`, `x-indexed` eligibility
 *   rules for `master` schemas.
 *
 * ## Why whole-schema replacement
 *
 * The schema-definition change is a ~550-line rewrite of the `attributes.schema`
 * validation; porting it node by node would be a second copy to keep in sync.
 * Both files are vendored verbatim under `./unreleased/`.
 *
 * ## Why it is safe
 *
 * The workflow forward-port is narrowed to 0.0.52-era pinned schemas: it only
 * fires when `definitions.availableInEntry` is present (introduced in
 * `v0.0.52`, still present in `v0.0.53` and master) AND `longPoll` exists
 * without `longPoll.properties.rule`. Pinned schemas v0.0.47–v0.0.51 have
 * `longPoll` but predate `availableInEntry` (and predate `resourceLock`,
 * `event` triggers, `workflowConfig.functionCache` too) and so are left
 * untouched — patching them against master would let the designer accept
 * constructs those runtimes reject. A vnext-schema release that ships
 * `longPoll.rule` makes the marker check moot for v0.0.52/v0.0.53 too (the
 * `longPoll.rule` presence check alone turns the patch inert). After bumping
 * the pin past that release, delete `./unreleased/` and this file.
 *
 * The schema-definition forward-port stays shape-detected across every
 * pinned version (same stance as `view-display-schema-patch`), not narrowed
 * by a version marker: master's only changes there are additive/permissive
 * for authored documents — `x-indexed` eligibility rules (a new constraint
 * the runtime enforces at publish anyway) and freeing `attributes.type` from
 * a closed enum. Accepted trade-off, not a gap.
 */
import unreleasedSchemaDefinition from './unreleased/schema.master.js'
import unreleasedWorkflowDefinition from './unreleased/workflow.master.js'

export const UNRELEASED_SCHEMA_SOURCE = 'vnext-schema@ac42026'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Pre-ac42026, 0.0.52-era workflow schema: carries the `availableInEntry`
 * marker (present from v0.0.52 onward, absent in v0.0.51 and earlier) and
 * still has `longPoll` without `longPoll.properties.rule`.
 */
function isStaleWorkflowSchema(schema: Record<string, unknown>): boolean {
  const definitions = asRecord(schema.definitions)
  if (definitions?.availableInEntry === undefined) return false
  const longPoll = asRecord(definitions.longPoll)
  if (!longPoll) return false
  return asRecord(longPoll.properties)?.rule === undefined
}

/** Pre-ac42026 schema-definition: `attributes.type` is still a closed enum. */
function isStaleSchemaDefinition(schema: Record<string, unknown>): boolean {
  const type = asRecord(asRecord(asRecord(asRecord(schema.properties)?.attributes)?.properties)?.type)
  return Array.isArray(type?.enum)
}

/**
 * Return the vendored master schema when `schema` is a stale workflow or
 * schema definition, otherwise `schema` unchanged. Never mutates its input.
 */
export function patchRuntimeSyncSchema(
  type: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (type === 'workflow' && isStaleWorkflowSchema(schema)) return unreleasedWorkflowDefinition
  if (type === 'schema' && isStaleSchemaDefinition(schema)) return unreleasedSchemaDefinition
  return schema
}
