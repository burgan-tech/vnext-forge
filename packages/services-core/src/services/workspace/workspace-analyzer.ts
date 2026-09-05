import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import type { FileSystemAdapter } from '../../adapters/index.js'
import { getErrnoCode } from '../../internal/errno.js'
import { basename, joinPosix } from '../../internal/paths.js'
import { CONFIG_FILE } from './constants.js'
import {
  normalizeWorkspaceRootToConfig,
  workspaceRootConfigSchema,
} from './workspace-config-schema.js'
import type {
  FileTreeNode,
  VnextWorkspaceConfig,
  WorkspaceAnalysisResult,
  WorkspaceConfigReadStatus,
} from './types.js'

export interface ReadConfigOptions {
  /** Solution file name inside the root; defaults to `vnext.config.json`. */
  configFileName?: string
}

/**
 * Pure: raw solution-file text → read status. `fileName` only decorates the
 * human-readable messages so a domain-suffixed file is reported under its own name.
 */
export function parseConfigStatus(raw: string, fileName: string): WorkspaceConfigReadStatus {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'invalid', message: `${fileName} is not a valid JSON file.` }
  }

  const checked = workspaceRootConfigSchema.safeParse(parsed)
  if (!checked.success) {
    const fieldErrors = checked.error.issues.slice(0, 5).map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : null
      return field ? `${field}: ${issue.message}` : issue.message
    })
    return {
      status: 'invalid',
      message: `${fileName} structure is invalid:\n${fieldErrors.join('\n')}`,
    }
  }

  return { status: 'ok', config: normalizeWorkspaceRootToConfig(checked.data) }
}

export function createWorkspaceAnalyzer(deps: { fs: FileSystemAdapter }) {
  const { fs } = deps

  async function readConfig(
    rootPath: string,
    traceId?: string,
    opts?: ReadConfigOptions,
  ): Promise<VnextWorkspaceConfig> {
    const configFileName = opts?.configFileName ?? CONFIG_FILE
    try {
      const raw = await fs.readFile(joinPosix(rootPath, configFileName))
      return JSON.parse(raw) as VnextWorkspaceConfig
    } catch (error) {
      throw toAnalyzerError(error, 'WorkspaceAnalyzer.readConfig', traceId, {
        rootPath,
        configFileName,
      })
    }
  }

  async function readConfigStatus(
    rootPath: string,
    traceId?: string,
    opts?: ReadConfigOptions,
  ): Promise<WorkspaceConfigReadStatus> {
    const configFileName = opts?.configFileName ?? CONFIG_FILE
    return readConfigStatusAtPath(joinPosix(rootPath, configFileName), traceId)
  }

  /**
   * Read + zod-validate a solution file at an explicit path. Shared by the
   * root-relative `readConfigStatus` and by the multi-solution scanner, so the
   * `missing` / `invalid` semantics stay identical for every solution file.
   */
  async function readConfigStatusAtPath(
    configPath: string,
    traceId?: string,
  ): Promise<WorkspaceConfigReadStatus> {
    let raw: string
    try {
      raw = await fs.readFile(configPath)
    } catch (error) {
      const code = getErrnoCode(error)
      if (code === 'ENOENT' || code === 'FileNotFound') return { status: 'missing' }
      throw toAnalyzerError(error, 'WorkspaceAnalyzer.readConfigStatus', traceId, { configPath })
    }
    return parseConfigStatus(raw, basename(configPath))
  }

  async function buildTree(rootPath: string, traceId?: string): Promise<FileTreeNode> {
    try {
      return await walkDirectory(rootPath)
    } catch (error) {
      throw toAnalyzerError(error, 'WorkspaceAnalyzer.buildTree', traceId, { rootPath })
    }
  }

  async function walkDirectory(dirPath: string): Promise<FileTreeNode> {
    const stat = await fs.stat(dirPath)
    if (!stat.isDirectory) {
      return { name: basename(dirPath), path: dirPath, type: 'file' }
    }

    const entries = await fs.readDir(dirPath)
    const children = await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => walkDirectory(joinPosix(dirPath, entry.name))),
    )

    return {
      name: basename(dirPath),
      path: dirPath,
      type: 'directory',
      children: children.sort((left, right) => {
        if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
        return left.name.localeCompare(right.name)
      }),
    }
  }

  async function analyze(rootPath: string, traceId?: string): Promise<WorkspaceAnalysisResult> {
    const [config, tree] = await Promise.all([
      tryReadConfig(rootPath, traceId),
      buildTree(rootPath, traceId),
    ])
    return { rootPath, config, configValid: config !== null, tree }
  }

  async function tryReadConfig(
    rootPath: string,
    traceId?: string,
  ): Promise<VnextWorkspaceConfig | null> {
    try {
      return await readConfig(rootPath, traceId)
    } catch (error) {
      if (error instanceof VnextForgeError && error.code === ERROR_CODES.FILE_NOT_FOUND) return null
      if (error instanceof VnextForgeError && error.code === ERROR_CODES.PROJECT_INVALID_CONFIG)
        return null
      throw error
    }
  }

  function toAnalyzerError(
    error: unknown,
    source: string,
    traceId: string | undefined,
    details: Record<string, unknown>,
  ): VnextForgeError {
    if (error instanceof VnextForgeError) return error
    if (error instanceof SyntaxError) {
      return new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'Workspace config file contains invalid JSON',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }

    const code = getErrnoCode(error)
    if (code === 'ENOENT' || code === 'FileNotFound') {
      return new VnextForgeError(
        ERROR_CODES.FILE_NOT_FOUND,
        'Workspace file or directory was not found',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }
    if (code === 'EACCES' || code === 'EPERM' || code === 'NoPermissions') {
      return new VnextForgeError(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        'Insufficient permissions to access the workspace',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }
    return new VnextForgeError(
      ERROR_CODES.PROJECT_LOAD_ERROR,
      error instanceof Error ? error.message : 'Workspace analysis failed',
      { source, layer: 'infrastructure', details },
      traceId,
    )
  }

  return { analyze, readConfig, readConfigStatus, readConfigStatusAtPath, buildTree }
}

export type WorkspaceAnalyzer = ReturnType<typeof createWorkspaceAnalyzer>
