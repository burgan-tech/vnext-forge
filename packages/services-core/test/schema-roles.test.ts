import * as fsp from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { FileSystemAdapter } from '../src/adapters/index.js'

import {
  analyzeSchemaRoles,
  collectSchemaRoleUsages,
  inferSchemaRole,
  scanSchemaRoleIssues,
  schemaTypeTextEdit,
  type ScannedComponent,
} from '../src/services/workspace/schema-roles.js'

function component(path: string, json: Record<string, unknown>): ScannedComponent {
  return { path, json, text: JSON.stringify(json, null, 2) }
}

const ref = (key: string, domain = 'core') => ({ key, domain, version: '1.0.0', flow: 'sys-schemas' })
const schema = (key: string, type?: unknown, domain = 'core') =>
  component(`/ws/core/Schemas/${key}.json`, {
    key,
    domain,
    flow: 'sys-schemas',
    attributes: { ...(type === undefined ? {} : { type }), schema: { type: 'object' } },
  })

const workflow = component('/ws/core/Workflows/order.json', {
  key: 'order',
  domain: 'core',
  flow: 'sys-flows',
  attributes: {
    schema: ref('order-master'),
    startTransition: { key: 'start', schema: ref('order-start') },
    sharedTransitions: [{ key: 'cancel-all', schema: ref('shared-body') }],
    cancel: { key: 'cancel', schema: ref('cancel-body') },
    states: [{ key: 's1', transitions: [{ key: 't1', schema: ref('approve-body') }] }],
  },
})

const fn = component('/ws/core/Functions/get-customer.json', {
  key: 'get-customer',
  domain: 'core',
  flow: 'sys-functions',
  attributes: {
    inputSchema: [{ rule: { code: 'x' }, schema: { ref: '../Schemas/fn-input.json' } }, { schema: ref('fn-input-2') }],
    outputSchema: ref('fn-output'),
  },
})

const view = component('/ws/core/Views/summary.json', {
  key: 'summary',
  domain: 'core',
  flow: 'sys-views',
  attributes: {
    type: 1,
    content: JSON.stringify({ component: { dataSchema: 'urn:vnext:res:schema:core:view-data:1.0.0' } }),
  },
})

describe('collectSchemaRoleUsages', () => {
  it('maps every reference kind to its role', () => {
    const components = [
      workflow,
      fn,
      view,
      ...['order-master', 'order-start', 'shared-body', 'cancel-body', 'approve-body', 'fn-input', 'fn-input-2', 'fn-output', 'view-data'].map(
        (key) => schema(key),
      ),
    ]
    const usages = collectSchemaRoleUsages(components)
    const roleOf = (key: string) => inferSchemaRole(usages.get(`/ws/core/Schemas/${key}.json`))
    expect(roleOf('order-master')).toBe('master')
    for (const key of ['order-start', 'shared-body', 'cancel-body', 'approve-body']) expect(roleOf(key)).toBe('transition')
    expect(roleOf('fn-input')).toBe('function')
    expect(roleOf('fn-input-2')).toBe('function')
    expect(roleOf('fn-output')).toBe('')
    expect(roleOf('view-data')).toBe('component')
  })

  it('prefers the exact domain and skips ambiguous keys', () => {
    const usages = collectSchemaRoleUsages([workflow, schema('order-master', 'x', 'core'), schema('order-master', 'x', 'other')])
    expect(usages.get('/ws/core/Schemas/order-master.json')).toHaveLength(1)
  })
})

describe('analyzeSchemaRoles', () => {
  it('flags a legacy type with the inferred role and the referencing files', () => {
    const issues = analyzeSchemaRoles([workflow, schema('order-start', 'schema')])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      code: 'component.schemaLegacyType',
      severity: 'error',
      filePath: '/ws/core/Schemas/order-start.json',
      related: ['/ws/core/Workflows/order.json'],
      fix: { value: 'transition' },
    })
    expect(issues[0]!.message).toContain('Use "transition"')
    expect(issues[0]!.range!.start.line).toBeGreaterThan(0)
  })

  it('lets workflow and function usages outweigh a view rendering the same schema', () => {
    const masterView = component('/ws/core/Views/master-view.json', {
      key: 'master-view',
      domain: 'core',
      flow: 'sys-views',
      attributes: { content: { dataSchema: 'urn:vnext:res:schema:core:order-master' } },
    })
    const [issue] = analyzeSchemaRoles([workflow, masterView, schema('order-master', 'workflow')])
    expect(issue!.fix).toEqual({ value: 'master' })
    expect(issue!.related).toEqual(['/ws/core/Workflows/order.json', '/ws/core/Views/master-view.json'])
    expect(analyzeSchemaRoles([workflow, masterView, schema('order-master', 'master')])).toEqual([])
  })

  it('offers removal when strong roles conflict', () => {
    const reuse = component('/ws/core/Functions/reuse.json', {
      key: 'reuse',
      domain: 'core',
      flow: 'sys-functions',
      attributes: { inputSchema: ref('order-master') },
    })
    const [issue] = analyzeSchemaRoles([workflow, reuse, schema('order-master', 'schema')])
    expect(issue!.fix).toEqual({ value: '' })
    expect(issue!.message).toContain('used in several roles (master, function)')
  })

  it('offers removal when the usage is ambiguous or absent', () => {
    const [issue] = analyzeSchemaRoles([schema('lonely', 'headers')])
    expect(issue!.fix).toEqual({ value: '' })
    expect(issue!.message).toContain('Remove it: no workflow, function or view references it')
  })

  it('warns when a role conflicts with how the schema is used', () => {
    const [issue] = analyzeSchemaRoles([workflow, schema('order-master', 'transition')])
    expect(issue).toMatchObject({ code: 'component.schemaRoleMismatch', severity: 'warning', fix: { value: 'master' } })
  })

  it('accepts matching roles and untyped schemas', () => {
    expect(analyzeSchemaRoles([workflow, schema('order-master', 'master'), schema('order-start')])).toEqual([])
  })

  it('skips solutions pinned below 0.0.56', () => {
    expect(analyzeSchemaRoles([schema('lonely', 'headers')], () => false)).toEqual([])
  })
})

describe('schemaTypeTextEdit', () => {
  const text = schema('x', 'schema').text
  const apply = (value: Parameters<typeof schemaTypeTextEdit>[1]) => {
    const edit = schemaTypeTextEdit(text, value)!
    return JSON.parse(text.slice(0, edit.start) + edit.newText + text.slice(edit.end)) as { attributes: Record<string, unknown> }
  }

  it('replaces only the value', () => {
    expect(apply('master').attributes.type).toBe('master')
  })

  it('removes the property for no role', () => {
    expect(apply('').attributes).not.toHaveProperty('type')
  })

  it('returns null without attributes.type', () => {
    expect(schemaTypeTextEdit(schema('y').text, 'master')).toBeNull()
  })
})

describe('scanSchemaRoleIssues (disk)', () => {
  const paths = {
    componentsRoot: 'core',
    tasks: 'Tasks',
    views: 'Views',
    functions: 'Functions',
    extensions: 'Extensions',
    workflows: 'Workflows',
    schemas: 'Schemas',
    mappings: 'Mappings',
  }
  let root = ''

  beforeEach(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'schema-roles-'))
    await fsp.mkdir(join(root, 'core/Workflows'), { recursive: true })
    await fsp.mkdir(join(root, 'core/Schemas/order'), { recursive: true })
    await fsp.writeFile(join(root, 'core/Workflows/order.json'), JSON.stringify(workflow.json, null, 2))
    await fsp.writeFile(
      join(root, 'core/Schemas/order/order-start.json'),
      JSON.stringify(schema('order-start', 'schema').json, null, 2),
    )
  })

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true })
  })

  const fs = {
    readFile: (p: string) => fsp.readFile(p, 'utf-8'),
    exists: async (p: string) =>
      fsp.access(p).then(
        () => true,
        () => false,
      ),
    readDir: async (p: string) =>
      (await fsp.readdir(p, { withFileTypes: true })).map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        isFile: e.isFile(),
      })),
  } as unknown as FileSystemAdapter

  it('reads nested folders and reports the legacy type on 0.0.56', async () => {
    const issues = await scanSchemaRoleIssues(fs, root, [{ paths, schemaVersion: '0.0.56' }])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: 'component.schemaLegacyType', fix: { value: 'transition' } })
    expect(issues[0]!.filePath.endsWith('core/Schemas/order/order-start.json')).toBe(true)
  })

  it('stays quiet for a 0.0.55 pin', async () => {
    expect(await scanSchemaRoleIssues(fs, root, [{ paths, schemaVersion: '0.0.55' }])).toEqual([])
  })
})
