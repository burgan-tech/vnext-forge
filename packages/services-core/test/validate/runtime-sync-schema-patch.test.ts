import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import { patchRuntimeSyncSchema } from '../../src/services/validate/runtime-sync-schema-patch.js'

const require_ = createRequire(import.meta.url)
const installed = require_('@burgan-tech/vnext-schema') as {
  getSchema(type: string): Record<string, unknown> | null
}

function compile(schema: Record<string, unknown>) {
  const opts = { strict: false, allErrors: true }
  const ajv = String(schema.$schema ?? '').includes('2019-09') ? new Ajv2019(opts) : new Ajv(opts)
  addFormats(ajv as unknown as Ajv)
  return ajv.compile(schema)
}

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/runtime-sync/${name}.json`, import.meta.url), 'utf8'))
}

const workflowSchema = () => patchRuntimeSyncSchema('workflow', installed.getSchema('workflow')!)
const schemaSchema = () => patchRuntimeSyncSchema('schema', installed.getSchema('schema')!)

describe('patchRuntimeSyncSchema — workflow', () => {
  it('replaces the stale installed workflow schema', () => {
    const original = installed.getSchema('workflow')!
    expect(patchRuntimeSyncSchema('workflow', original)).not.toBe(original)
  })

  it('is a no-op once the schema already carries longPoll.rule', () => {
    const patched = workflowSchema()
    expect(patchRuntimeSyncSchema('workflow', patched)).toBe(patched)
  })

  it('leaves other component types untouched', () => {
    const task = installed.getSchema('task')!
    expect(patchRuntimeSyncSchema('task', task)).toBe(task)
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

describe('patchRuntimeSyncSchema — schema definition', () => {
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
