import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require_ = createRequire(import.meta.url)

interface SchemaModule {
  getSchema(type: string): Record<string, unknown> | null
}

/**
 * Proves the bundled `@burgan-tech/vnext-schema` knows FanOut (task type 21).
 *
 * Type 21 shipped in vnext-schema 0.0.53. Forge pinned `^0.0.39` for a long
 * time, and on a 0.0.x package the caret does not widen, so the bundled schema
 * silently stayed at 0.0.39 and rejected every fan-out task the designer
 * produced. This suite runs against the package actually installed, not a
 * fixture, so a future pin regression fails loudly here.
 */
function installedTaskSchema(): Record<string, unknown> {
  const mod = require_('@burgan-tech/vnext-schema') as SchemaModule
  const schema = mod.getSchema('task')
  if (!schema) throw new Error('task schema not found in @burgan-tech/vnext-schema')
  return schema
}

function compile(schema: Record<string, unknown>) {
  const ajv = new Ajv({ strict: false, allErrors: true })
  addFormats(ajv as never)
  return ajv.compile(schema)
}

/** Spec §10.1 (`vnext/docs/integration/forge-fanout-task-implementation.md`). */
function fanOutTask(config: Record<string, unknown>): Record<string, unknown> {
  return {
    key: 'fan-out-online-document-launch',
    domain: 'contract',
    version: '1.0.0',
    flow: 'sys-tasks',
    flowVersion: '1.0.0',
    tags: ['fan-out', 'parallel'],
    attributes: { type: '21', config },
  }
}

const INNER_TASK = {
  key: 'launch-online-document-subprocesses',
  domain: 'contract',
  flow: 'sys-tasks',
  version: '1.0.0',
}

describe('installed task schema — FanOut (type 21)', () => {
  const validate = compile(installedTaskSchema())

  it('lists 21 in the type enum', () => {
    const schema = installedTaskSchema()
    const attributes = (schema.properties as Record<string, Record<string, unknown>>).attributes
    const type = (attributes.properties as Record<string, Record<string, unknown>>).type
    expect(type.enum).toContain('21')
  })

  it('accepts the spec §10.1 itemsPath example', () => {
    const ok = validate(
      fanOutTask({
        _comment: 'domain teams document intent here; must survive round-trip',
        mode: 'inline',
        itemsPath: '$.documents.online',
        itemAlias: 'document',
        task: INNER_TASK,
        execution: { maxDegreeOfParallelism: 4, itemTimeoutSeconds: 30, batchTimeoutSeconds: 120 },
        join: { policy: 'allSettled', resultKey: 'onlineLaunchResults', ordered: true },
      }),
    )
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it('accepts the spec §10.2 ItemSelector example with a per-item error boundary', () => {
    const ok = validate(
      fanOutTask({
        mode: 'inline',
        itemAlias: 'subprocess',
        task: { ...INNER_TASK, key: 'notify-subprocesses-finalize' },
        execution: { maxDegreeOfParallelism: 4, itemTimeoutSeconds: 30, batchTimeoutSeconds: 120 },
        join: { policy: 'allSettled', resultKey: 'finalizeResults', ordered: true },
        errorBoundary: {
          onError: [
            {
              action: 3,
              errorCodes: ['400', '404', '409', 'Task:400', 'Task:404', 'Task:409'],
              priority: 1,
            },
          ],
        },
      }),
    )
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it('accepts the minimal form (only the inner task)', () => {
    expect(validate(fanOutTask({ task: INNER_TASK }))).toBe(true)
  })

  it('rejects a missing inner task', () => {
    expect(validate(fanOutTask({ itemsPath: '$.items' }))).toBe(false)
  })

  it('rejects an inner task missing one of key/domain/flow/version', () => {
    const { version: _version, ...partial } = INNER_TASK
    expect(validate(fanOutTask({ task: partial }))).toBe(false)
  })

  it('rejects quorum without minSuccess', () => {
    expect(validate(fanOutTask({ task: INNER_TASK, join: { policy: 'quorum' } }))).toBe(false)
  })

  it('accepts quorum with minSuccess', () => {
    expect(validate(fanOutTask({ task: INNER_TASK, join: { policy: 'quorum', minSuccess: 2 } }))).toBe(true)
  })

  it('rejects an unknown join policy', () => {
    expect(validate(fanOutTask({ task: INNER_TASK, join: { policy: 'majority' } }))).toBe(false)
  })

  it('rejects a mode other than inline', () => {
    expect(validate(fanOutTask({ task: INNER_TASK, mode: 'durable' }))).toBe(false)
  })

  it('rejects an itemsPath that is not "$."-rooted', () => {
    expect(validate(fanOutTask({ task: INNER_TASK, itemsPath: 'documents.online' }))).toBe(false)
  })

  it('rejects out-of-range execution numbers', () => {
    expect(
      validate(fanOutTask({ task: INNER_TASK, execution: { maxDegreeOfParallelism: 0 } })),
    ).toBe(false)
  })

  it('rejects unknown config keys other than _comment', () => {
    expect(validate(fanOutTask({ task: INNER_TASK, itemsPaths: '$.x' }))).toBe(false)
  })
})
