import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { buildMethodRegistry } from '../src/registry/method-registry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, 'fixtures')

interface FixtureFile {
  params: unknown
  result: unknown
}

describe('method registry contract (R-b9 + R-a2)', () => {
  const registry = buildMethodRegistry()
  const names = Object.keys(registry).sort((a, b) => a.localeCompare(b))

  it('registered method names (sorted)', () => {
    expect(names).toMatchInlineSnapshot(`
      [
        "files.browse",
        "files.delete",
        "files.mkdir",
        "files.read",
        "files.rename",
        "files.search",
        "files.write",
        "health.check",
        "projects.create",
        "projects.export",
        "projects.getById",
        "projects.getComponentFileTypes",
        "projects.getConfig",
        "projects.getConfigStatus",
        "projects.getTree",
        "projects.getValidateScriptStatus",
        "projects.getVnextComponentLayoutStatus",
        "projects.getWorkspaceBootstrap",
        "projects.import",
        "projects.list",
        "projects.remove",
        "projects.seedVnextComponentLayout",
        "projects.writeConfig",
        "runtime.proxy",
        "templates.validateScriptStatus",
        "validate.component",
        "validate.getAllSchemas",
        "validate.getAvailableTypes",
        "validate.getSchema",
        "validate.workflow",
      ]
    `)
  })

  it('fixture params/result parse against each method zod schemas when present', () => {
    const missingFixtures: string[] = []

    for (const method of names) {
      const fixturePath = path.join(fixturesDir, `${method}.json`)
      if (!existsSync(fixturePath)) {
        missingFixtures.push(method)
        continue
      }

      const parsed = JSON.parse(readFileSync(fixturePath, 'utf8')) as Partial<FixtureFile>
      if (!('params' in parsed) || !('result' in parsed)) {
        throw new Error(
          `${method}.json must include both "params" and "result" (use null only if schemas allow).`,
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

    if (missingFixtures.length > 0) {
      console.warn(
        `[registry-contract] No fixture for ${missingFixtures.length} method(s); add test/fixtures/<method>.json incrementally.`,
      )
      console.warn(`[registry-contract] Missing: ${missingFixtures.join(', ')}`)
    }
  })
})
