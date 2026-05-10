import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import { z } from 'zod'

import type { LoggerAdapter } from '../../adapters/index.js'
import type { SchemaCacheService } from '../schema-cache/index.js'

interface VnextSchemaModule {
  getSchema(type: string): Record<string, unknown> | null
  getAvailableTypes(): string[]
  schemas: Record<string, Record<string, unknown>>
}

export interface ComponentValidationError {
  path: string
  message: string
  params?: Record<string, unknown>
}

export interface ComponentValidationResult {
  valid: boolean
  errors: ComponentValidationError[]
  warnings: ComponentValidationError[]
}

type ValidatorEntry = {
  validate: ReturnType<Ajv['compile']>
  type: string
}

/**
 * Resolves the @burgan-tech/vnext-schema module. Each shell injects the right
 * loader (CJS require for the extension bundle, ESM dynamic import for the
 * web-server) so services-core stays agnostic of the bundler.
 */
export interface VnextSchemaLoader {
  load(): VnextSchemaModule
}

// ── zod schemas ──────────────────────────────────────────────────────────────

export const validateWorkflowParams = z.object({
  content: z.unknown(),
  /**
   * Project's `vnext.config.json#schemaVersion` (e.g. "0.0.33"). When
   * provided, the service resolves that exact version of
   * `@burgan-tech/vnext-schema` from the user-data cache (downloading
   * from npm on first miss). When absent, falls back to the bundled
   * version baked into the desktop app's services-core build.
   */
  schemaVersion: z.string().min(1).optional(),
})
export const validateComponentParams = z.object({
  content: z.unknown(),
  type: z.string().min(1),
  schemaVersion: z.string().min(1).optional(),
})

const validationErrorShape = z.object({
  path: z.string(),
  message: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
})
export const validationResultShape = z.object({
  valid: z.boolean(),
  errors: z.array(validationErrorShape),
  warnings: z.array(validationErrorShape),
})

export const validateGetAvailableTypesParams = z.object({}).optional().transform(() => ({}))
export const validateGetAvailableTypesResult = z.array(z.string())

export const validateGetAllSchemasParams = z.object({}).optional().transform(() => ({}))
export const validateGetAllSchemasResult = z.record(z.string(), z.record(z.string(), z.unknown()))

export const validateGetSchemaParams = z.object({
  type: z.string().min(1),
  /**
   * Optional `@burgan-tech/vnext-schema` version. When supplied the
   * server resolves the schema from the per-version cache (downloading
   * on first miss) so the UI sees the exact contract the project pinned
   * via `vnext.config.json#schemaVersion`. Falls back to the bundled
   * version when the project hasn't pinned anything.
   */
  schemaVersion: z.string().min(1).optional(),
})
export const validateGetSchemaResult = z.record(z.string(), z.unknown()).nullable()

export interface ValidateServiceDeps {
  schemaLoader: VnextSchemaLoader
  logger: LoggerAdapter
  /**
   * Optional version-aware schema loader. When supplied, callers can pass
   * `schemaVersion` to `validateComponent` and the service will resolve a
   * cached / downloaded copy of `@burgan-tech/vnext-schema@<version>`
   * instead of always using the bundled one. Composition wires this in
   * for the desktop / web-server shells; the VS Code extension shell
   * leaves it undefined to keep its bundle lean.
   */
  schemaCacheService?: SchemaCacheService
}

/**
 * Internal key for AJV validators keyed by (version, type). The "bundled"
 * sentinel slots into the same map so backwards-compatible callers (no
 * version supplied) hit the same cache as version-aware ones requesting
 * the bundled version explicitly.
 */
const BUNDLED_KEY = '__bundled__'

function getAjvInstance(schema: Record<string, unknown>): Ajv {
  const draft = (schema.$schema as string) ?? ''
  const ajvOpts = { strict: false, allErrors: true, verbose: true }
  if (draft.includes('2019-09')) {
    const ajv = new Ajv2019(ajvOpts)
    addFormats(ajv as unknown as Ajv)
    return ajv as unknown as Ajv
  }
  const ajv = new Ajv(ajvOpts)
  addFormats(ajv)
  return ajv
}

function mapAjvErrors(ajvErrors: Ajv['errors']): ComponentValidationError[] {
  if (!ajvErrors) return []
  return ajvErrors.map((err) => {
    const errPath = err.instancePath || ''
    let message = err.message ?? 'Unknown validation error'
    if (
      message.includes('must NOT have additional properties') &&
      err.params &&
      'additionalProperty' in err.params
    ) {
      message = `must NOT have additional property "${err.params.additionalProperty}"`
    }
    if (
      message.includes('must have required property') &&
      err.params &&
      'missingProperty' in err.params
    ) {
      message = `must have required property "${err.params.missingProperty}"`
    }
    return {
      path: errPath,
      message,
      params: err.params as Record<string, unknown> | undefined,
    }
  })
}

export function createValidateService(deps: ValidateServiceDeps) {
  const { schemaLoader, schemaCacheService } = deps

  // Per-version cache:
  //  - `__bundled__`  → AJV validators compiled from the desktop's bundled package
  //  - "<x.y.z>"      → AJV validators compiled from the user-data-cached package
  // Each entry holds its loaded module reference so getAllSchemas / getSchema
  // can serve metadata without a second round-trip.
  const moduleByKey = new Map<string, VnextSchemaModule>()
  const validatorsByKey = new Map<string, Map<string, ValidatorEntry>>()
  // True when the requested version download failed and we silently fell
  // back to bundled; the registry surfaces this in the response so the UI
  // can warn the user about a possibly-mismatched validation.
  const fellBackToBundled = new Set<string>()

  function compileValidatorsForModule(module: VnextSchemaModule): Map<string, ValidatorEntry> {
    const map = new Map<string, ValidatorEntry>()
    for (const type of module.getAvailableTypes()) {
      const schema = module.getSchema(type)
      if (!schema) continue
      try {
        const ajv = getAjvInstance(schema)
        const validate = ajv.compile(schema)
        map.set(type, { validate, type })
      } catch {
        // Skip schemas that fail to compile (forward-compat with newer
        // package shapes that reference unknown formats / drafts).
      }
    }
    return map
  }

  function ensureBundled(): {
    module: VnextSchemaModule
    validators: Map<string, ValidatorEntry>
  } {
    let mod = moduleByKey.get(BUNDLED_KEY)
    let vals = validatorsByKey.get(BUNDLED_KEY)
    if (!mod) {
      mod = schemaLoader.load()
      moduleByKey.set(BUNDLED_KEY, mod)
    }
    if (!vals) {
      vals = compileValidatorsForModule(mod)
      validatorsByKey.set(BUNDLED_KEY, vals)
    }
    return { module: mod, validators: vals }
  }

  /**
   * Resolve an entry for the requested version. Falls back to bundled (and
   * marks the version as "fell-back") when the cache service is missing or
   * the download failed — in which case the caller's validation runs with
   * the bundled schema and the response carries a warning.
   */
  async function ensureForVersion(version: string | undefined): Promise<{
    module: VnextSchemaModule
    validators: Map<string, ValidatorEntry>
    /** The version actually used. Differs from `version` on bundled fallback. */
    actualVersion: string
    fromBundle: boolean
  }> {
    if (!version || !schemaCacheService) {
      const bundled = ensureBundled()
      return {
        module: bundled.module,
        validators: bundled.validators,
        actualVersion: 'bundled',
        fromBundle: true,
      }
    }

    const cacheKey = version
    let mod = moduleByKey.get(cacheKey)
    let vals = validatorsByKey.get(cacheKey)
    if (mod && vals) {
      return {
        module: mod,
        validators: vals,
        actualVersion: version,
        fromBundle: fellBackToBundled.has(cacheKey),
      }
    }

    const resolved = await schemaCacheService.resolve(version)
    if (resolved.fromBundle) fellBackToBundled.add(cacheKey)

    mod = resolved.module
    moduleByKey.set(cacheKey, mod)
    vals = compileValidatorsForModule(mod)
    validatorsByKey.set(cacheKey, vals)
    return {
      module: mod,
      validators: vals,
      actualVersion: resolved.version,
      fromBundle: resolved.fromBundle,
    }
  }

  /**
   * Sync, bundled-only validation entry point. Kept for hosts that don't
   * pipe in a schemaCacheService (extension webview today) and for the
   * pre-existing internal callers like `pre-commit` that don't yet thread
   * `schemaVersion` through.
   */
  function validateComponent(content: unknown, componentType: string): ComponentValidationResult {
    const { validators } = ensureBundled()
    const entry = validators.get(componentType)
    if (!entry) {
      return {
        valid: false,
        errors: [
          {
            path: '',
            message: `Unknown component type: "${componentType}". Available: ${Array.from(validators.keys()).join(', ')}`,
          },
        ],
        warnings: [],
      }
    }
    const valid = entry.validate(content)
    if (valid) return { valid: true, errors: [], warnings: [] }
    return { valid: false, errors: mapAjvErrors(entry.validate.errors), warnings: [] }
  }

  /**
   * Async, version-aware validation. New entry point for callers that
   * thread the project's `schemaVersion` through. When `schemaVersion` is
   * absent it behaves exactly like the sync `validateComponent`.
   */
  async function validateComponentVersioned(
    content: unknown,
    componentType: string,
    schemaVersion?: string,
  ): Promise<ComponentValidationResult> {
    const { validators } = await ensureForVersion(schemaVersion)
    const entry = validators.get(componentType)
    if (!entry) {
      return {
        valid: false,
        errors: [
          {
            path: '',
            message: `Unknown component type: "${componentType}". Available: ${Array.from(validators.keys()).join(', ')}`,
          },
        ],
        warnings: [],
      }
    }
    const valid = entry.validate(content)
    if (valid) return { valid: true, errors: [], warnings: [] }
    return { valid: false, errors: mapAjvErrors(entry.validate.errors), warnings: [] }
  }

  function validate(workflow: unknown): ComponentValidationResult {
    return validateComponent(workflow, 'workflow')
  }

  function getAvailableTypes(): string[] {
    const { validators } = ensureBundled()
    return Array.from(validators.keys())
  }

  function getAllSchemas(): Record<string, Record<string, unknown>> {
    const { module: mod } = ensureBundled()
    const result: Record<string, Record<string, unknown>> = {}
    for (const type of mod.getAvailableTypes()) {
      const schema = mod.getSchema(type)
      if (schema) result[type] = schema
    }
    return result
  }

  function getSchema(type: string): Record<string, unknown> | null {
    const { module: mod } = ensureBundled()
    return mod.getSchema(type)
  }

  /**
   * Schema-version-aware variant. Resolves through `schemaCacheService`
   * (downloads the matching `@burgan-tech/vnext-schema` package if it's
   * not already cached) and falls back to the bundled module when no
   * version is supplied or the cache service isn't wired (extension
   * shell). Used by component metadata forms that want their `required`
   * markers / field constraints to reflect the project's pinned schema
   * version, not whatever ships with the desktop app.
   */
  async function getSchemaVersioned(
    type: string,
    schemaVersion?: string,
  ): Promise<Record<string, unknown> | null> {
    if (!schemaVersion || !schemaCacheService) {
      return getSchema(type)
    }
    try {
      const resolved = await schemaCacheService.resolve(schemaVersion)
      return resolved.module.getSchema(type)
    } catch (err) {
      // Stay forward-compatible: if download / cache fails, fall back to
      // the bundled schema rather than blowing up the form.
      deps.logger.warn(
        `[validate.service] getSchemaVersioned fallback to bundled (${schemaVersion}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      return getSchema(type)
    }
  }

  return {
    validate,
    validateComponent,
    validateComponentVersioned,
    getAvailableTypes,
    getAllSchemas,
    getSchema,
    getSchemaVersioned,
  }
}

export type ValidateService = ReturnType<typeof createValidateService>
