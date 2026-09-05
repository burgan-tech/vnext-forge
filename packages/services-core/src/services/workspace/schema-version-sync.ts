/**
 * Keep a solution's `package.json` in step with `vnext.config.json#schemaVersion`.
 *
 * Mirrors the template's `sync-schema-version.js` (`^<schemaVersion>` range) but
 * also updates `devDependencies` when the package is pinned there, preserves
 * the file's indentation / trailing newline, and works through the
 * `FileSystemAdapter` so the server shell and the extension host share it.
 * Running `npm install` afterwards is the shell's job (the extension sends it
 * to the Forge terminal; the server has no terminal).
 */
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

import type { FileSystemAdapter } from '../../adapters/index.js'

export const VNEXT_SCHEMA_PACKAGE = '@burgan-tech/vnext-schema'

export type PackageJsonDependencySection = 'dependencies' | 'devDependencies'

export interface PackageJsonUpdate {
  changed: boolean
  nextText: string
  /** Sections whose `@burgan-tech/vnext-schema` entry was written. */
  touched: PackageJsonDependencySection[]
  /** `^<schemaVersion>` */
  range: string
}

export function schemaVersionRange(schemaVersion: string): string {
  const trimmed = schemaVersion.trim()
  return /^[\^~]/.test(trimmed) ? trimmed : `^${trimmed}`
}

/**
 * Pure: `package.json` text → updated text. `dependencies` always receives the
 * range (created when absent); `devDependencies` only when it already pins the
 * package. Throws `PROJECT_INVALID_CONFIG` on unparsable JSON.
 */
export function computePackageJsonUpdate(
  pkgJsonText: string,
  schemaVersion: string,
): PackageJsonUpdate {
  const range = schemaVersionRange(schemaVersion)
  let parsed: unknown
  try {
    parsed = JSON.parse(pkgJsonText)
  } catch (error) {
    throw new VnextForgeError(
      ERROR_CODES.PROJECT_INVALID_CONFIG,
      'package.json is not valid JSON',
      {
        source: 'schema-version-sync.computePackageJsonUpdate',
        layer: 'infrastructure',
        details: { reason: error instanceof Error ? error.message : String(error) },
      },
    )
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new VnextForgeError(
      ERROR_CODES.PROJECT_INVALID_CONFIG,
      'package.json must contain a JSON object',
      { source: 'schema-version-sync.computePackageJsonUpdate', layer: 'infrastructure' },
    )
  }

  const pkg = parsed as Record<string, unknown>
  const touched: PackageJsonDependencySection[] = []

  const deps = asRecord(pkg.dependencies) ?? {}
  if (deps[VNEXT_SCHEMA_PACKAGE] !== range) {
    deps[VNEXT_SCHEMA_PACKAGE] = range
    pkg.dependencies = deps
    touched.push('dependencies')
  }

  const devDeps = asRecord(pkg.devDependencies)
  if (devDeps && VNEXT_SCHEMA_PACKAGE in devDeps && devDeps[VNEXT_SCHEMA_PACKAGE] !== range) {
    devDeps[VNEXT_SCHEMA_PACKAGE] = range
    touched.push('devDependencies')
  }

  if (touched.length === 0) {
    return { changed: false, nextText: pkgJsonText, touched, range }
  }

  const indent = detectIndent(pkgJsonText)
  const trailingNewline = /\r?\n$/.test(pkgJsonText) ? (pkgJsonText.includes('\r\n') ? '\r\n' : '\n') : ''
  const nextText = JSON.stringify(pkg, null, indent) + trailingNewline
  return { changed: true, nextText, touched, range }
}

/** Read → compute → write. Returns `changed: false` when nothing had to be written. */
export async function applySchemaVersionToPackageJson(
  fs: FileSystemAdapter,
  packageJsonPath: string,
  schemaVersion: string,
): Promise<{ changed: boolean; touched: PackageJsonDependencySection[]; range: string }> {
  const current = await fs.readFile(packageJsonPath)
  const update = computePackageJsonUpdate(current, schemaVersion)
  if (update.changed) {
    await fs.writeFile(packageJsonPath, update.nextText)
  }
  return { changed: update.changed, touched: update.touched, range: update.range }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function detectIndent(text: string): string | number {
  const match = /^[ \t]+(?=")/m.exec(text)
  if (!match) return 2
  const ws = match[0]
  return ws.includes('\t') ? '\t' : ws.length
}
