import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  CONFIG_FILE,
  normalizeWorkspaceRootToConfig,
  workspaceRootConfigSchema,
} from '@vnext-forge-studio/services-core'
import type { WorkspaceConfigReadStatus } from '@vnext-forge-studio/services-core'

type Cached = { mtimeMs: number; status: WorkspaceConfigReadStatus }
const byRoot = new Map<string, Cached>()

function rootKey(rootPath: string): string {
  return path.normalize(rootPath)
}

/**
 * vnext.config.json + zod: workspaceAnalyzer.readConfigStatus ile aynı mantık, ancak
 * `onDidOpenTextDocument` içinde bekleme olmadan kullanılmak üzere senkron (disk).
 */
export function readVnextConfigStatusSyncFromDisk(rootPath: string): WorkspaceConfigReadStatus {
  const configPath = path.join(rootPath, CONFIG_FILE)
  let raw: string
  try {
    raw = fs.readFileSync(configPath, 'utf-8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { status: 'missing' }
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'invalid', message: 'vnext.config.json is not a valid JSON file.' }
  }

  const checked = workspaceRootConfigSchema.safeParse(parsed)
  if (!checked.success) {
    const fieldErrors = checked.error.issues.slice(0, 5).map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : null
      return field ? `${field}: ${issue.message}` : issue.message
    })
    return {
      status: 'invalid',
      message: `vnext.config.json structure is invalid:\n${fieldErrors.join('\n')}`,
    }
  }

  return { status: 'ok', config: normalizeWorkspaceRootToConfig(checked.data) }
}

/**
 * Aynı dosya tıklamalarında `readFileSync` maliyetini azalt; `vnext.config` değişince
 * `mtime` fark edilir ve yeniden okunur.
 */
export function readVnextConfigStatusSyncCached(rootPath: string): WorkspaceConfigReadStatus {
  const key = rootKey(rootPath)
  const configPath = path.join(rootPath, CONFIG_FILE)
  let mtimeMs: number
  try {
    mtimeMs = fs.statSync(configPath).mtimeMs
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      byRoot.delete(key)
      return { status: 'missing' }
    }
    throw error
  }

  const hit = byRoot.get(key)
  if (hit && hit.mtimeMs === mtimeMs) {
    return hit.status
  }
  const status = readVnextConfigStatusSyncFromDisk(rootPath)
  byRoot.set(key, { mtimeMs, status })
  return status
}

/** Ayar değişikliği / test: önbelleği temizle. */
export function invalidateVnextConfigReadCacheForTests(): void {
  byRoot.clear()
}
