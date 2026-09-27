import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

import type { LoggerAdapter } from '../../src/adapters/index.js'
import type { SchemaCacheService } from '../../src/services/schema-cache/index.js'
import { createValidateService, type VnextSchemaLoader } from '../../src/services/validate/validate.service.js'

const require_ = createRequire(import.meta.url)
const schemaLoader: VnextSchemaLoader = { load: () => require_('@burgan-tech/vnext-schema') }
const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: vi.fn(),
  error: () => undefined,
} as unknown as LoggerAdapter

/** A pre-0.0.54 schema definition: `attributes.type` is still a closed enum. */
const staleSchemaDefinition = {
  properties: { attributes: { properties: { type: { type: 'string', enum: ['workflow', 'schema'] } } } },
}
const pinnedModule = {
  getAvailableTypes: () => ['schema'],
  getSchema: (type: string) => (type === 'schema' ? staleSchemaDefinition : null),
  schemas: {},
}

function cache(resolve: SchemaCacheService['resolve']): SchemaCacheService {
  return { resolve, has: vi.fn(), refresh: vi.fn(), listCachedVersions: vi.fn() } as unknown as SchemaCacheService
}

describe('getAllSchemasVersioned', () => {
  it('serves the pinned package as published (no forward-port since 0.0.54)', async () => {
    const resolve = vi.fn(() => Promise.resolve({ module: pinnedModule, version: '0.0.40', fromBundle: false }))
    const service = createValidateService({ schemaLoader, logger, schemaCacheService: cache(resolve) })

    const schemas = await service.getAllSchemasVersioned('0.0.40')

    expect(resolve).toHaveBeenCalledWith('0.0.40')
    expect(Object.keys(schemas)).toEqual(['schema'])
    const type = (schemas.schema as { properties: { attributes: { properties: { type: { enum?: unknown } } } } })
      .properties.attributes.properties.type
    // A project pinned below 0.0.54 is validated exactly as its own
    // `npm run validate` would validate it.
    expect(type.enum).toEqual(['workflow', 'schema'])
  })

  it('serves the bundled package without a version', async () => {
    const resolve = vi.fn()
    const service = createValidateService({ schemaLoader, logger, schemaCacheService: cache(resolve) })

    const schemas = await service.getAllSchemasVersioned(undefined)

    expect(resolve).not.toHaveBeenCalled()
    expect(schemas.workflow).toBeDefined()
  })

  it('falls back to the bundled package when the pinned version cannot be resolved', async () => {
    const resolve = vi.fn(() => Promise.reject(new Error('offline')))
    const service = createValidateService({ schemaLoader, logger, schemaCacheService: cache(resolve) })

    const schemas = await service.getAllSchemasVersioned('9.9.9')

    expect(schemas.workflow).toBeDefined()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('serves the bundled package when no cache service is wired (no schemaCacheService)', async () => {
    const service = createValidateService({ schemaLoader, logger })
    expect((await service.getAllSchemasVersioned('0.0.40')).workflow).toBeDefined()
  })
})
