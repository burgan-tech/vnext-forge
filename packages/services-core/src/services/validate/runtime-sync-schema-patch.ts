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
 * Shape-detected, not version-gated (same stance as `view-display-schema-patch`):
 * it fires only while the loaded schema still has the old shape. A vnext-schema
 * release carrying these commits makes it inert. After bumping the pin, delete
 * `./unreleased/` and this file.
 *
 * Projects pinning a much older `schemaVersion` also receive the master schema.
 * Master is a superset for authored documents except the new constraints
 * (roles/rule exclusivity, `x-indexed` eligibility), which the runtime enforces
 * at publish anyway.
 */
import unreleasedSchemaDefinition from './unreleased/schema.master.js'
import unreleasedWorkflowDefinition from './unreleased/workflow.master.js'

export const UNRELEASED_SCHEMA_SOURCE = 'vnext-schema@ac42026'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Pre-ac42026 workflow schema: `longPoll` exists but has no `rule` arm. */
function isStaleWorkflowSchema(schema: Record<string, unknown>): boolean {
  const longPoll = asRecord(asRecord(schema.definitions)?.longPoll)
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
