import {
  classifySchemaType,
  schemaRolesEnforced,
  type SchemaRole,
} from '@vnext-forge-studio/vnext-types'

import type { FileSystemAdapter } from '../../adapters/file-system.js'
import { locateJsonProperty, offsetToPosition, removePropertyRange } from '../../internal/json-locate.js'
import { toPosix } from '../../internal/paths.js'
import { collectJsonCandidatesFromDisk } from '../project/vnext-component-scanner.js'
import { buildComponentFolderRelPaths } from '../project/vnext-component-folder-paths.js'
import type { VnextWorkspacePaths } from './types.js'

/**
 * Schema-role inference (vnext-schema ≥ 0.0.56). A schema's role follows from
 * where it is referenced:
 *  - a workflow's `attributes.schema`                     → master
 *  - a transition `schema` (start, shared, state, cancel,
 *    exit, updateData)                                     → transition
 *  - a function's `attributes.inputSchema`                 → function
 *  - a view's `dataSchema` URN                             → component
 * A view usually renders a schema that already has another role (the master
 * data, a transition form), so a view reference is weak evidence: it decides
 * `component` only when no workflow or function references the schema.
 * Several different strong roles, or no reference, mean "no role".
 */

export interface ScannedComponent {
  /** POSIX path of the component file. */
  path: string
  text: string
  json: Record<string, unknown>
}

export interface SchemaRoleUsage {
  role: SchemaRole
  /** File that references the schema. */
  referrer: string
}

/** 0-based range in the schema file. */
export interface TextRange {
  start: { line: number; character: number }
  end: { line: number; character: number }
}

export type SchemaRoleIssueCode = 'component.schemaLegacyType' | 'component.schemaRoleMismatch'

export interface SchemaRoleIssue {
  code: SchemaRoleIssueCode
  severity: 'error' | 'warning'
  message: string
  filePath: string
  /** Files that reference the schema. */
  related: string[]
  /** `attributes.type` value, or the start of the file when it has none. */
  range?: TextRange
  /** Value to write to `attributes.type`; `''` removes it. Absent → no automatic fix. */
  fix?: { value: SchemaRole | '' }
}

const SCHEMA_FLOW = 'sys-schemas'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** Resolves schema references to schema file paths. */
class SchemaIndex {
  private readonly byDomainKey = new Map<string, string[]>()
  private readonly byKey = new Map<string, string[]>()
  private readonly paths = new Set<string>()

  constructor(components: readonly ScannedComponent[]) {
    for (const component of components) {
      if (component.json.flow !== SCHEMA_FLOW) continue
      const key = str(component.json.key)?.toLowerCase()
      if (!key) continue
      const domain = str(component.json.domain)?.toLowerCase() ?? ''
      push(this.byDomainKey, `${domain}|${key}`, component.path)
      push(this.byKey, key, component.path)
      this.paths.add(component.path)
    }
  }

  resolve(key: unknown, domain: unknown): string | undefined {
    const k = str(key)?.toLowerCase()
    if (!k) return undefined
    const d = str(domain)?.toLowerCase()
    if (d) {
      const exact = this.byDomainKey.get(`${d}|${k}`)
      if (exact?.length === 1) return exact[0]
      if (exact && exact.length > 1) return undefined
    }
    const anyDomain = this.byKey.get(k)
    return anyDomain?.length === 1 ? anyDomain[0] : undefined
  }

  resolvePath(path: string): string | undefined {
    return this.paths.has(path) ? path : undefined
  }
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

function joinRelative(base: string, rel: string): string {
  const out = base.split('/')
  for (const segment of rel.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') out.pop()
    else out.push(segment)
  }
  return out.join('/')
}

/** `{key, domain, …}` resource reference or `{ref: './x.json'}` file reference. */
function resolveRef(index: SchemaIndex, ref: unknown, fromFile: string): string | undefined {
  if (!isRecord(ref)) return undefined
  const fileRef = str(ref.ref)
  if (fileRef) return index.resolvePath(joinRelative(dirname(fromFile), fileRef))
  return index.resolve(ref.key, ref.domain)
}

function workflowTransitions(attributes: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const key of ['startTransition', 'cancel', 'exit', 'updateData']) {
    if (isRecord(attributes[key])) out.push(attributes[key] as Record<string, unknown>)
  }
  if (Array.isArray(attributes.sharedTransitions)) out.push(...attributes.sharedTransitions.filter(isRecord))
  if (Array.isArray(attributes.states)) {
    for (const state of attributes.states) {
      if (isRecord(state) && Array.isArray(state.transitions)) out.push(...state.transitions.filter(isRecord))
    }
  }
  return out
}

/** Every schema reference of a function slot (single ref, rule list, or `{schemas: [...]}`). */
function slotRefs(slot: unknown): unknown[] {
  if (Array.isArray(slot)) return slot.filter(isRecord).map((entry) => entry.schema)
  if (isRecord(slot) && Array.isArray(slot.schemas)) return slotRefs(slot.schemas)
  return [slot]
}

const SCHEMA_URN = /^urn:vnext:res:schema:([^:]+):([^:]+)(?::.+)?$/

/** `dataSchema` URNs anywhere in a view's content (string or object). */
function viewDataSchemas(content: unknown): { domain: string; key: string }[] {
  let root = content
  if (typeof root === 'string') {
    try {
      root = JSON.parse(root) as unknown
    } catch {
      return []
    }
  }
  const out: { domain: string; key: string }[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!isRecord(node)) return
    for (const [key, value] of Object.entries(node)) {
      if (key === 'dataSchema' && typeof value === 'string') {
        const match = SCHEMA_URN.exec(value.trim())
        if (match) out.push({ domain: match[1]!, key: match[2]! })
      } else {
        walk(value)
      }
    }
  }
  walk(root)
  return out
}

/** Schema file path → every place it is referenced. */
export function collectSchemaRoleUsages(
  components: readonly ScannedComponent[],
): Map<string, SchemaRoleUsage[]> {
  const index = new SchemaIndex(components)
  const usages = new Map<string, SchemaRoleUsage[]>()
  const add = (schemaPath: string | undefined, role: SchemaRole, referrer: string) => {
    if (!schemaPath) return
    const list = usages.get(schemaPath) ?? []
    list.push({ role, referrer })
    usages.set(schemaPath, list)
  }

  for (const component of components) {
    const attributes = component.json.attributes
    if (!isRecord(attributes)) continue
    switch (component.json.flow) {
      case 'sys-flows':
        add(resolveRef(index, attributes.schema, component.path), 'master', component.path)
        for (const transition of workflowTransitions(attributes)) {
          add(resolveRef(index, transition.schema, component.path), 'transition', component.path)
        }
        break
      case 'sys-functions':
        for (const ref of slotRefs(attributes.inputSchema)) {
          add(resolveRef(index, ref, component.path), 'function', component.path)
        }
        break
      case 'sys-views':
        for (const urn of viewDataSchemas(attributes.content)) {
          add(index.resolve(urn.key, urn.domain), 'component', component.path)
        }
        break
    }
  }
  return usages
}

/** Roles from workflow and function references; view references are left out. */
function strongRoles(usages: readonly SchemaRoleUsage[]): Set<SchemaRole> {
  return new Set(usages.filter((usage) => usage.role !== 'component').map((usage) => usage.role))
}

/**
 * The role the usages point to, or `''`: the single workflow/function role
 * when there is one, `component` when only views reference the schema, and
 * nothing when the strong roles conflict or there is no reference.
 */
export function inferSchemaRole(usages: readonly SchemaRoleUsage[] | undefined): SchemaRole | '' {
  const list = usages ?? []
  const strong = strongRoles(list)
  if (strong.size === 1) return [...strong][0]!
  if (strong.size > 1) return ''
  return list.length > 0 ? 'component' : ''
}

function typeRange(component: ScannedComponent): TextRange {
  const location = locateJsonProperty(component.text, ['attributes', 'type'])
  if (!location) return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
  return {
    start: offsetToPosition(component.text, location.valueStart),
    end: offsetToPosition(component.text, location.valueEnd),
  }
}

function describeUsage(role: SchemaRole | '', usages: readonly SchemaRoleUsage[]): string {
  switch (role) {
    case 'master':
      return "it is a workflow's master schema"
    case 'transition':
      return 'it is used as a transition body'
    case 'function':
      return "it is a function's input schema"
    case 'component':
      return "it is a view's data schema"
    default: {
      const roles = [...strongRoles(usages)]
      return roles.length > 1
        ? `it is used in several roles (${roles.join(', ')})`
        : 'no workflow, function or view references it'
    }
  }
}

/**
 * Role issues for the schema components among `components`.
 * `rolesEnforcedFor(path)` says whether the schema's solution pins
 * vnext-schema ≥ 0.0.56; older pins accept free-text types.
 */
export function analyzeSchemaRoles(
  components: readonly ScannedComponent[],
  rolesEnforcedFor: (schemaPath: string) => boolean = () => true,
): SchemaRoleIssue[] {
  const usages = collectSchemaRoleUsages(components)
  const issues: SchemaRoleIssue[] = []
  for (const component of components) {
    if (component.json.flow !== SCHEMA_FLOW || !rolesEnforcedFor(component.path)) continue
    const attributes = isRecord(component.json.attributes) ? component.json.attributes : {}
    const current = classifySchemaType(attributes.type)
    const schemaUsages = usages.get(component.path) ?? []
    const related = [...new Set(schemaUsages.map((usage) => usage.referrer))]
    const inferred = inferSchemaRole(schemaUsages)

    if (current.kind === 'legacy') {
      issues.push({
        code: 'component.schemaLegacyType',
        severity: 'error',
        message: inferred
          ? `attributes.type "${current.value}" is a legacy value; vnext-schema 0.0.56 accepts only a schema role. Use "${inferred}": ${describeUsage(inferred, schemaUsages)}.`
          : `attributes.type "${current.value}" is a legacy value; vnext-schema 0.0.56 accepts only a schema role. Remove it: ${describeUsage('', schemaUsages)}.`,
        filePath: component.path,
        related,
        range: typeRange(component),
        fix: { value: inferred },
      })
      continue
    }

    if (current.kind === 'role') {
      // Views render schemas of every role, so only workflow/function usages conflict.
      const conflicting = [...strongRoles(schemaUsages)].filter((role) => role !== current.role)
      if (conflicting.length === 0) continue
      issues.push({
        code: 'component.schemaRoleMismatch',
        severity: 'warning',
        message: `This schema has the ${current.role} role but is used as ${conflicting
          .map((role) => (role === 'master' ? 'a master schema' : `a ${role} schema`))
          .join(' and ')}; the ${current.role} vocabulary decides which annotations it may carry.`,
        filePath: component.path,
        related: [
          ...new Set(
            schemaUsages
              .filter((usage) => usage.role !== 'component' && usage.role !== current.role)
              .map((usage) => usage.referrer),
          ),
        ],
        range: typeRange(component),
        ...(inferred ? { fix: { value: inferred } } : {}),
      })
    }
  }
  return issues
}

export interface SchemaRoleScanSolution {
  /** `vnext.config.json#paths`. */
  paths: VnextWorkspacePaths
  /** `vnext.config.json#schemaVersion`. */
  schemaVersion?: string
}

/**
 * Reads every component JSON of the given solutions under `rootPath`.
 * `enforcedByPath` records whether each file's solution pins vnext-schema
 * ≥ 0.0.56.
 */
export async function readScannedComponents(
  fs: FileSystemAdapter,
  rootPath: string,
  solutions: readonly SchemaRoleScanSolution[],
): Promise<{ components: ScannedComponent[]; enforcedByPath: Map<string, boolean> }> {
  const components: ScannedComponent[] = []
  const enforcedByPath = new Map<string, boolean>()
  for (const solution of solutions) {
    const relPaths = buildComponentFolderRelPaths(solution.paths)
    if (!relPaths) continue
    const enforced = schemaRolesEnforced(solution.schemaVersion)
    const candidates = await collectJsonCandidatesFromDisk(fs, rootPath, relPaths)
    for (const { path } of candidates) {
      const posix = toPosix(path)
      if (enforcedByPath.has(posix)) continue
      try {
        const text = await fs.readFile(path)
        const json = JSON.parse(text) as unknown
        if (!isRecord(json)) continue
        components.push({ path: posix, text, json })
        enforcedByPath.set(posix, enforced)
      } catch {
        // Unreadable or invalid JSON is reported by the component validators.
      }
    }
  }
  return { components, enforcedByPath }
}

/**
 * Schema-role issues of every component of the given solutions under
 * `rootPath`. References are resolved across those solutions; each schema is
 * judged by its own solution's `schemaVersion`.
 */
export async function scanSchemaRoleIssues(
  fs: FileSystemAdapter,
  rootPath: string,
  solutions: readonly SchemaRoleScanSolution[],
): Promise<SchemaRoleIssue[]> {
  const { components, enforcedByPath } = await readScannedComponents(fs, rootPath, solutions)
  return analyzeSchemaRoles(components, (path) => enforcedByPath.get(path) ?? true)
}

/** Offset-based replacement in a schema file's text. */
export interface SchemaTypeTextEdit {
  start: number
  end: number
  newText: string
}

/**
 * Minimal edit that sets `attributes.type` to `value` (`''` removes it),
 * keeping the rest of the file's formatting. `null` when the file has no
 * `attributes.type` to change (adding one is left to the editor).
 */
export function schemaTypeTextEdit(text: string, value: SchemaRole | ''): SchemaTypeTextEdit | null {
  const location = locateJsonProperty(text, ['attributes', 'type'])
  if (!location) return null
  if (value === '') return { ...removePropertyRange(text, location), newText: '' }
  return { start: location.valueStart, end: location.valueEnd, newText: JSON.stringify(value) }
}
