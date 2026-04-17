import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'

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

let vnextSchema: VnextSchemaModule | null = null
const validators = new Map<string, ValidatorEntry>()
let initialized = false

function loadSchemas(): VnextSchemaModule {
  if (vnextSchema) return vnextSchema
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  vnextSchema = require('@burgan-tech/vnext-schema') as VnextSchemaModule
  return vnextSchema
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
      // skip schemas that fail to compile
    }
  }

  initialized = true
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

export const validateService = {
  validateComponent(
    content: unknown,
    componentType: string,
  ): ComponentValidationResult {
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
    if (valid) {
      return { valid: true, errors: [], warnings: [] }
    }

    return {
      valid: false,
      errors: mapAjvErrors(entry.validate.errors),
      warnings: [],
    }
  },

  validate(workflow: unknown): ComponentValidationResult {
    return this.validateComponent(workflow, 'workflow')
  },

  getAvailableTypes(): string[] {
    ensureInitialized()
    return Array.from(validators.keys())
  },

  getAllSchemas(): Record<string, Record<string, unknown>> {
    const mod = loadSchemas()
    const types = mod.getAvailableTypes()
    const result: Record<string, Record<string, unknown>> = {}

    for (const type of types) {
      const schema = mod.getSchema(type)
      if (schema) {
        result[type] = schema
      }
    }

    return result
  },

  getSchema(type: string): Record<string, unknown> | null {
    const mod = loadSchemas()
    return mod.getSchema(type)
  },
}
