import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import { z } from 'zod'

import type { LoggerAdapter } from '../../adapters/index.js'

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

export const validateWorkflowParams = z.object({ content: z.unknown() })
export const validateComponentParams = z.object({
  content: z.unknown(),
  type: z.string().min(1),
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

export const validateGetSchemaParams = z.object({ type: z.string().min(1) })
export const validateGetSchemaResult = z.record(z.string(), z.unknown()).nullable()

export interface ValidateServiceDeps {
  schemaLoader: VnextSchemaLoader
  logger: LoggerAdapter
}

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
  const { schemaLoader } = deps

  let module: VnextSchemaModule | null = null
  const validators = new Map<string, ValidatorEntry>()
  let initialized = false

  function loadSchemas(): VnextSchemaModule {
    if (module) return module
    module = schemaLoader.load()
    return module
  }

  function ensureInitialized(): void {
    if (initialized) return
    const mod = loadSchemas()
    const types = mod.getAvailableTypes()
    for (const type of types) {
      const schema = mod.getSchema(type)
      if (!schema) continue
      try {
        const ajv = getAjvInstance(schema)
        const validate = ajv.compile(schema)
        validators.set(type, { validate, type })
      } catch {
        // Skip schemas that fail to compile.
      }
    }
    initialized = true
  }

  function validateComponent(content: unknown, componentType: string): ComponentValidationResult {
    ensureInitialized()
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
    ensureInitialized()
    return Array.from(validators.keys())
  }

  function getAllSchemas(): Record<string, Record<string, unknown>> {
    const mod = loadSchemas()
    const result: Record<string, Record<string, unknown>> = {}
    for (const type of mod.getAvailableTypes()) {
      const schema = mod.getSchema(type)
      if (schema) result[type] = schema
    }
    return result
  }

  function getSchema(type: string): Record<string, unknown> | null {
    return loadSchemas().getSchema(type)
  }

  return {
    validate,
    validateComponent,
    getAvailableTypes,
    getAllSchemas,
    getSchema,
  }
}

export type ValidateService = ReturnType<typeof createValidateService>
