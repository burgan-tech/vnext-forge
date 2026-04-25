import { z } from 'zod'
import * as vscode from 'vscode'

import { coercedBool, csvList } from '@vnext-forge/app-contracts'

/**
 * Centralized config for the VS Code extension host.
 *
 * Source priority (highest first):
 *   1. VS Code workspace settings under the `vnextForge.*` namespace
 *      (configured by the operator via Settings UI / `settings.json`).
 *   2. Process env vars (`VNEXT_RUNTIME_URL`, `VNEXT_RUNTIME_ALLOWED_BASE_URLS`,
 *      `VNEXT_ALLOW_RUNTIME_URL_OVERRIDE`) inherited from the shell that
 *      launched the VS Code instance — useful for CI / dev sandboxes.
 *   3. Hardcoded safe defaults defined here.
 *
 * The composition root (`composition/services.ts`) reads from this module
 * instead of touching `process.env` directly, mirroring the same
 * "single env reader per shell" pattern that `apps/server/src/shared/config/`
 * applies for the Hono server. This is what R-b6 of the audit asks for.
 */

const SETTINGS_NS = 'vnextForge'

interface ExtensionConfig {
  /** Default vNext runtime base URL used by the runtime-proxy service. */
  vnextRuntimeUrl: string
  /**
   * Allow-listed runtime base URLs the proxy may target. The default
   * `vnextRuntimeUrl` is implicitly always allowed; this list extends it.
   */
  runtimeAllowedBaseUrls: string[]
  /**
   * When `true`, callers may override the proxy target via the
   * `runtimeUrl` parameter on `runtime.proxy`. OFF by default to avoid
   * SSRF-shaped foot-guns inside the trusted extension host channel.
   */
  allowRuntimeUrlOverride: boolean
}

function readSetting<T>(key: string, fallback: T): T {
  const cfg = vscode.workspace.getConfiguration(SETTINGS_NS)
  const value = cfg.get<T>(key)
  return value === undefined ? fallback : value
}

function readEnv(key: string): string | undefined {
  const value = process.env[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function csvToArray(value: string | undefined): string[] {
  // Delegate to the shared `csvList` zod transform so the parsing rules
  // (trim, drop empties) match what the server config does for env vars
  // like CORS_ALLOWED_ORIGINS.
  if (value === undefined) return []
  const parsed = csvList.safeParse(value)
  if (parsed.success && parsed.data !== undefined) return parsed.data
  return []
}

function readBoolean(envKey: string, settingKey: string, fallback: boolean): boolean {
  const envValue = readEnv(envKey)
  if (envValue !== undefined) {
    const parsed = coercedBool.safeParse(envValue)
    if (parsed.success) return parsed.data
  }
  return readSetting<boolean>(settingKey, fallback)
}

const RuntimeUrlSchema = z.string().url()

function loadExtensionConfig(): ExtensionConfig {
  const rawRuntimeUrl =
    readEnv('VNEXT_RUNTIME_URL') ??
    readSetting<string>('vnextRuntimeUrl', 'http://localhost:4201')
  const runtimeUrlParsed = RuntimeUrlSchema.safeParse(rawRuntimeUrl)
  const vnextRuntimeUrl = runtimeUrlParsed.success
    ? runtimeUrlParsed.data
    : 'http://localhost:4201'

  const runtimeAllowedBaseUrls = (() => {
    const fromEnv = readEnv('VNEXT_RUNTIME_ALLOWED_BASE_URLS')
    if (fromEnv !== undefined) return csvToArray(fromEnv)
    const fromSettings = readSetting<string[] | undefined>('runtimeAllowedBaseUrls', undefined)
    if (!Array.isArray(fromSettings)) return []
    return fromSettings.filter((entry): entry is string => RuntimeUrlSchema.safeParse(entry).success)
  })()

  const allowRuntimeUrlOverride = readBoolean(
    'VNEXT_ALLOW_RUNTIME_URL_OVERRIDE',
    'allowRuntimeUrlOverride',
    false,
  )

  return {
    vnextRuntimeUrl,
    runtimeAllowedBaseUrls,
    allowRuntimeUrlOverride,
  }
}

export const extensionConfig: ExtensionConfig = loadExtensionConfig()
