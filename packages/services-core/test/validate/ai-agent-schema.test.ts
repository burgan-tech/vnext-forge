import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const require_ = createRequire(import.meta.url)

interface SchemaModule {
  getSchema(type: string): Record<string, unknown> | null
  getAvailableTypes(): string[]
}

/**
 * Proves the bundled `@burgan-tech/vnext-schema` knows the AI Agent contract
 * (vnext-schema 0.0.60, runtime 0.0.105, vnext#1105): `stateType: 6` with its
 * `agent` block, transition `description`, the `sys-agents` component and the
 * Mcp task (type 24). Runs against the installed package, like the FanOut
 * guard, and is skipped while the pin is still below 0.0.60.
 */
const mod = require_('@burgan-tech/vnext-schema') as SchemaModule
const hasAgentSchema = mod.getAvailableTypes().includes('agent')

const FIXTURES = join(__dirname, '../../../designer-ui/src/modules/agent-editor/__fixtures__/ai-agent-lab')

function compile(type: string) {
  const schema = mod.getSchema(type)!
  // workflow-definition is draft 2019-09; agent and task are draft-07.
  const ajv = String(schema.$schema ?? '').includes('2019-09')
    ? new Ajv2019({ strict: false, allErrors: true })
    : new Ajv({ strict: false, allErrors: true })
  addFormats(ajv as never)
  return ajv.compile(schema)
}

function files(dir: string): { name: string; json: unknown }[] {
  return readdirSync(join(FIXTURES, dir))
    .filter((n) => n.endsWith('.json'))
    .map((name) => ({ name, json: JSON.parse(readFileSync(join(FIXTURES, dir, name), 'utf8')) }))
}

describe.skipIf(!hasAgentSchema)('bundled vnext-schema: AI Agent contract', () => {
  it('accepts the 7 ai-agent-lab flows', () => {
    const validate = compile('workflow')
    for (const { name, json } of files('workflows')) {
      expect(validate(json), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
    }
  })

  it('accepts the 4 ai-agent-lab agents', () => {
    const validate = compile('agent')
    for (const { name, json } of files('agents')) {
      expect(validate(json), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
    }
  })

  it('accepts an Mcp task with secretRef credentials and rejects a plain-text header value', () => {
    const validate = compile('task')
    const task = (headers: unknown) => ({
      key: 'crm-mcp',
      domain: 'core',
      version: '1.0.0',
      flow: 'sys-tasks',
      flowVersion: '1.0.0',
      tags: ['mcp'],
      attributes: {
        type: '24',
        config: {
          transport: 'http',
          endpoint: 'https://crm-mcp.internal/mcp',
          auth: { header: 'Authorization', scheme: 'Bearer', secretRef: 'vault/workflow-secret/CRM_MCP_TOKEN' },
          headers,
          operation: 'callTool',
          tool: 'search_customer',
          timeoutSeconds: 20,
        },
      },
    })
    expect(validate(task({ 'X-Tenant': { secretRef: 'CRM_TENANT' } })), JSON.stringify(validate.errors)).toBe(true)
    expect(validate(task({ 'X-Tenant': 'plain-text' }))).toBe(false)
  })
})
