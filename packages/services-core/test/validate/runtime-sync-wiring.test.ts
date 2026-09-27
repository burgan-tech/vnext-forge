import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import { createValidateService, type VnextSchemaLoader } from '../../src/services/validate/validate.service.js'
import type { LoggerAdapter } from '../../src/adapters/index.js'

const require_ = createRequire(import.meta.url)

// Mirrors the extension shell composition (apps/extension/src/composition/services.ts):
// static require of the bundled @burgan-tech/vnext-schema package, no schemaCacheService.
const schemaLoader: VnextSchemaLoader = {
  load: () => require_('@burgan-tech/vnext-schema'),
}

const noopLogger: LoggerAdapter = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as LoggerAdapter

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/runtime-sync/${name}.json`, import.meta.url), 'utf8'))
}

describe('createValidateService — serves the bundled 0.0.54 runtime-sync constructs', () => {
  const service = createValidateService({ schemaLoader, logger: noopLogger })

  it('serves the workflow schema with the long-poll rule arm (definitions.longPoll.properties.rule)', () => {
    const workflow = service.getAllSchemas().workflow as {
      definitions?: { longPoll?: { properties?: Record<string, unknown> } }
    }
    expect(workflow?.definitions?.longPoll?.properties?.rule).toBeDefined()
  })

  it('serves the schema definition with a free-text attributes.type (no enum on attributes.type)', () => {
    const schemaDef = service.getSchema('schema') as {
      properties?: { attributes?: { properties?: { type?: { enum?: unknown } } } }
    }
    expect(schemaDef?.properties?.attributes?.properties?.type?.enum).toBeUndefined()
  })

  it('rejects a long poll with both roles and rule', () => {
    const doc = fixture('subflow-override-lab-child') as {
      attributes: { states: { interaction?: { longPoll?: Record<string, unknown> } }[] }
    }
    const state = doc.attributes.states.find((s) => s.interaction?.longPoll)!
    state.interaction!.longPoll!.rule = { location: './src/Rule.csx', code: 'cmV0dXJuIHRydWU7' }

    const result = service.validateComponent(doc, 'workflow')
    expect(result.valid).toBe(false)
  })

  it('accepts the unmodified fixture', () => {
    const doc = fixture('subflow-override-lab-child')
    const result = service.validateComponent(doc, 'workflow')
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })
})
