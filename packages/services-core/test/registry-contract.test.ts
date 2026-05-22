import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { METHOD_HTTP_METADATA } from '@vnext-forge-studio/app-contracts'

import { buildMethodRegistry } from '../src/registry/method-registry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, 'fixtures')

interface FixtureFile {
  params: unknown
  result: unknown
}

function fixturePathForMethod(method: string): string {
  return path.join(fixturesDir, ...method.split('/')) + '.json'
}

describe('method registry contract (R-b9 + R-a2)', () => {
  const registry = buildMethodRegistry()
  const names = Object.keys(registry).sort((a, b) => a.localeCompare(b))

  it('registered method names (sorted)', () => {
    expect(names).toMatchInlineSnapshot(`
      [
        "cli/check",
        "cli/checkUpdate",
        "cli/domainAdd",
        "cli/execute",
        "cli/updateGlobal",
        "files/browse",
        "files/delete",
        "files/mkdir",
        "files/read",
        "files/rename",
        "files/search",
        "files/search/stream",
        "files/write",
        "health/check",
        "projects/create",
        "projects/export",
        "projects/getById",
        "projects/getComponentFileTypes",
        "projects/getConfig",
        "projects/getConfigStatus",
        "projects/getTree",
        "projects/getValidateScriptStatus",
        "projects/getVnextComponentLayoutStatus",
        "projects/getWorkspaceBootstrap",
        "projects/import",
        "projects/list",
        "projects/remove",
        "projects/seedVnextComponentLayout",
        "projects/writeConfig",
        "quickrun-presets/delete",
        "quickrun-presets/get",
        "quickrun-presets/list",
        "quickrun-presets/save",
        "quickrun/fireTransition",
        "quickrun/getData",
        "quickrun/getHistory",
        "quickrun/getInstance",
        "quickrun/getSchema",
        "quickrun/getState",
        "quickrun/getView",
        "quickrun/listInstances",
        "quickrun/retryInstance",
        "quickrun/startInstance",
        "quickswitcher/buildIndex",
        "runtime/proxy",
        "sessions/clear",
        "sessions/get",
        "sessions/save",
        "snippets/delete",
        "snippets/getOne",
        "snippets/listAll",
        "snippets/openLocation",
        "snippets/save",
        "templates/validateScriptStatus",
        "test-data/generate",
        "test-data/generateForSchemaComponent",
        "test-data/generateForSchemaReference",
        "validate/component",
        "validate/getAllSchemas",
        "validate/getAvailableTypes",
        "validate/getSchema",
        "validate/workflow",
        "vnext/components/list",
        "vnext/extensions/list",
        "vnext/functions/list",
        "vnext/schemas/list",
        "vnext/tasks/list",
        "vnext/views/list",
        "vnext/workflows/list",
      ]
    `)
  })

  it('METHOD_HTTP_METADATA keys match registry keys (parity)', () => {
    const metaKeys = Object.keys(METHOD_HTTP_METADATA).sort((a, b) => a.localeCompare(b))
    expect(metaKeys).toEqual(names)
  })

  it('fixture params/result parse against each method zod schemas when present', () => {
    const missingFixtures: string[] = []

    for (const method of names) {
      const fixtureFile = fixturePathForMethod(method)
      if (!existsSync(fixtureFile)) {
        missingFixtures.push(method)
        continue
      }

      const parsed = JSON.parse(readFileSync(fixtureFile, 'utf8')) as Partial<FixtureFile>
      if (!('params' in parsed) || !('result' in parsed)) {
        throw new Error(
          `${method} fixture must include both "params" and "result" (use null only if schemas allow).`,
        )
      }

      const entry = registry[method]
      expect(entry, `registry entry for ${method}`).toBeDefined()
      if (!entry) continue

      entry.paramsSchema.parse(parsed.params)
      if (entry.resultSchema) {
        entry.resultSchema.parse(parsed.result)
      }
    }

    // Fixtures are added incrementally; avoid noisy CI logs — run locally without CI=1 to see missing list.
    if (missingFixtures.length > 0 && !process.env.CI) {
      // eslint-disable-next-line no-console -- dev-only fixture coverage hint
      console.warn(
        `[registry-contract] No fixture for ${missingFixtures.length} method(s); add test/fixtures/<domain>/<action>.json incrementally.`,
      )
      // eslint-disable-next-line no-console -- dev-only fixture coverage hint
      console.warn(`[registry-contract] Missing: ${missingFixtures.join(', ')}`)
    }
  })
})
