import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * The September 2026 runtime constructs (timeout annotations, expanded
 * subFlow.overrides, long-poll roles/rule oneOf, free-text attributes.type,
 * x-indexed rules) shipped in @burgan-tech/vnext-schema 0.0.54. Forge carried a
 * local forward-port until that release; these tests now pin the bundled
 * package itself so a future pin change cannot silently drop them.
 */
const require_ = createRequire(import.meta.url)
const installed = require_('@burgan-tech/vnext-schema') as {
  getSchema(type: string): Record<string, unknown> | null
}
const installedVersion = (require_('@burgan-tech/vnext-schema/package.json') as { version: string }).version

function compile(schema: Record<string, unknown>) {
  const opts = { strict: false, allErrors: true }
  const ajv = String(schema.$schema ?? '').includes('2019-09') ? new Ajv2019(opts) : new Ajv(opts)
  addFormats(ajv as unknown as Ajv)
  return ajv.compile(schema)
}

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/runtime-sync/${name}.json`, import.meta.url), 'utf8'))
}

const workflowSchema = () => installed.getSchema('workflow')!
const schemaSchema = () => installed.getSchema('schema')!

describe('bundled vnext-schema — workflow definition', () => {
  it('is 0.0.54 or newer', () => {
    const [major, minor, patch] = installedVersion.split('.').map(Number)
    expect(major * 1e6 + minor * 1e3 + patch).toBeGreaterThanOrEqual(54)
  })

  it('carries the long-poll rule arm and availableIn entries', () => {
    const definitions = workflowSchema().definitions as Record<string, { properties?: Record<string, unknown> }>
    expect(definitions.longPoll?.properties?.rule).toBeDefined()
    expect(definitions.availableInEntry).toBeDefined()
    expect(definitions.workflowTimeout?.properties?.annotations).toBeDefined()
  })

  it.each(['timeout-lab-root', 'subflow-override-lab-parent', 'subflow-override-lab-child'])(
    'accepts vnext-example %s',
    (name) => {
      const validate = compile(workflowSchema())
      const ok = validate(fixture(name))
      expect(validate.errors ?? []).toEqual([])
      expect(ok).toBe(true)
    },
  )

  it('rejects a long poll with both roles and rule', () => {
    const doc = fixture('subflow-override-lab-child') as {
      attributes: { states: { interaction?: { longPoll?: Record<string, unknown> } }[] }
    }
    const state = doc.attributes.states.find((s) => s.interaction?.longPoll)!
    state.interaction!.longPoll!.rule = { location: './src/Rule.csx', code: 'cmV0dXJuIHRydWU7' }
    expect(compile(workflowSchema())(doc)).toBe(false)
  })
})

describe('bundled vnext-schema — schema definition', () => {
  const base = {
    key: 'order-master',
    version: '1.0.0',
    domain: 'core',
    flow: 'sys-schemas',
    flowVersion: '1.0.0',
    tags: ['t'],
  }
  const withSchema = (type: string, props: Record<string, unknown>) => ({
    ...base,
    attributes: { type, schema: { type: 'object', properties: props } },
  })

  it('accepts x-indexed on a scalar field of a master schema', () => {
    const validate = compile(schemaSchema())
    expect(validate(withSchema('master', { amount: { type: 'number', 'x-indexed': true } }))).toBe(true)
  })

  it('rejects x-indexed on a non-master schema', () => {
    const validate = compile(schemaSchema())
    expect(validate(withSchema('schema', { amount: { type: 'number', 'x-indexed': true } }))).toBe(false)
  })

  it('rejects x-indexed on an array field', () => {
    const validate = compile(schemaSchema())
    expect(
      validate(withSchema('master', { list: { type: 'array', items: { type: 'string' }, 'x-indexed': true } })),
    ).toBe(false)
  })

  it('accepts a free-text attributes.type', () => {
    const validate = compile(schemaSchema())
    expect(validate(withSchema('headers-v2', { a: { type: 'string' } }))).toBe(true)
  })
})
