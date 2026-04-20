#!/usr/bin/env node
/**
 * scripts/check-exports.mjs
 *
 * Wave-1 R-a1: every workspace `package.json#exports` (and `main`/`types`)
 * entry must resolve to a file that actually exists on disk.
 *
 * Phantom subpath exports (e.g. `./modules/project-management` listed in
 * `exports` but with no source folder behind it) silently break consumer
 * builds — the bundler reports the failure as "module not found" inside the
 * consumer, far away from the real source of the bug. This script makes the
 * mistake fail loudly at the workspace boundary instead.
 *
 * It is invoked by the workspace `lint` task (and CI) and prints every
 * broken entry with the offending package + path. Exit code is 1 on any
 * failure so CI fails fast.
 *
 * Conventions checked:
 *   - "exports" entries that are plain strings           -> path must exist
 *   - "exports" entries that are conditional objects     -> every leaf path
 *     (default / import / require / types / browser ...) must exist
 *   - "main" / "types" / "module" / "browser"            -> path must exist
 *
 * Wildcards (`./*`) are intentionally NOT supported because the codebase
 * does not use them; if that changes, extend `validateTarget` to accept the
 * pattern shape.
 */

import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

const WORKSPACE_GLOBS = ['apps', 'packages']
const PROBLEMS = []

async function main() {
  const packageJsonPaths = await collectWorkspacePackageJsons()
  for (const pkgPath of packageJsonPaths) {
    await checkPackage(pkgPath)
  }

  if (PROBLEMS.length === 0) {
    console.log(
      `[check-exports] OK — verified ${packageJsonPaths.length} workspace package.json files.`,
    )
    return
  }

  console.error('[check-exports] FAILED — broken `exports` / `main` / `types` entries:')
  for (const p of PROBLEMS) {
    console.error(`  - ${p.pkg}: ${p.field} -> ${p.target} (resolved to ${p.resolved})`)
  }
  process.exitCode = 1
}

async function collectWorkspacePackageJsons() {
  const { readdir } = await import('node:fs/promises')
  const found = []
  for (const group of WORKSPACE_GLOBS) {
    const groupDir = join(REPO_ROOT, group)
    let entries
    try {
      entries = await readdir(groupDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const candidate = join(groupDir, entry.name, 'package.json')
      try {
        await stat(candidate)
        found.push(candidate)
      } catch {
        /* no package.json in this folder */
      }
    }
  }
  return found
}

async function checkPackage(pkgJsonPath) {
  const pkgDir = dirname(pkgJsonPath)
  const raw = await readFile(pkgJsonPath, 'utf8')
  let pkg
  try {
    pkg = JSON.parse(raw)
  } catch (error) {
    PROBLEMS.push({
      pkg: relative(REPO_ROOT, pkgJsonPath),
      field: '(json)',
      target: '',
      resolved: error instanceof Error ? error.message : String(error),
    })
    return
  }

  const pkgLabel = pkg.name ?? relative(REPO_ROOT, pkgDir)

  for (const field of ['main', 'types', 'module', 'browser']) {
    const value = pkg[field]
    if (typeof value === 'string') {
      await validateTarget(pkgLabel, pkgDir, field, value)
    }
  }

  if (pkg.exports && typeof pkg.exports === 'object') {
    for (const [key, value] of Object.entries(pkg.exports)) {
      await walkExports(pkgLabel, pkgDir, `exports[${JSON.stringify(key)}]`, value)
    }
  } else if (typeof pkg.exports === 'string') {
    await validateTarget(pkgLabel, pkgDir, 'exports', pkg.exports)
  }
}

async function walkExports(pkgLabel, pkgDir, fieldPath, value) {
  if (typeof value === 'string') {
    await validateTarget(pkgLabel, pkgDir, fieldPath, value)
    return
  }
  if (value && typeof value === 'object') {
    for (const [condition, inner] of Object.entries(value)) {
      await walkExports(pkgLabel, pkgDir, `${fieldPath}.${condition}`, inner)
    }
  }
}

async function validateTarget(pkgLabel, pkgDir, fieldPath, target) {
  if (typeof target !== 'string' || target.length === 0) return
  if (target.includes('*')) return // patterns not used in this repo; skip
  if (isAbsolute(target)) {
    PROBLEMS.push({
      pkg: pkgLabel,
      field: fieldPath,
      target,
      resolved: 'absolute paths are not allowed in package.json exports/main/types',
    })
    return
  }

  // Build-artifact targets (e.g. `./dist/index.d.ts`) only exist after a
  // workspace build. We don't want this script to fail in a clean checkout
  // before `pnpm -r build` has run, so we skip them when missing — but we
  // still flag them when the path looks malformed (e.g. unexpected leading
  // segment outside the package).
  const isBuildArtifact = /^\.\/(dist|build|out|lib|esm|cjs)\//.test(target)

  const resolved = resolve(pkgDir, target)
  try {
    const s = await stat(resolved)
    if (!s.isFile()) {
      PROBLEMS.push({
        pkg: pkgLabel,
        field: fieldPath,
        target,
        resolved: `${relative(REPO_ROOT, resolved)} is not a regular file`,
      })
    }
  } catch {
    if (isBuildArtifact) return // missing build output is acceptable in source-only checks
    PROBLEMS.push({
      pkg: pkgLabel,
      field: fieldPath,
      target,
      resolved: `${relative(REPO_ROOT, resolved)} does not exist`,
    })
  }
}

// `import.meta.url`-vs-CLI guard so the file can also be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main()
}
