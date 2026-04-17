import fs from 'node:fs/promises'
import path from 'node:path'
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import { CONFIG_FILE } from './constants'
import { normalizeWorkspaceRootToConfig, workspaceRootConfigSchema } from '@handlers/project/workspace-config-schema'
import type { FileTreeNode, VnextWorkspaceConfig, WorkspaceAnalysisResult } from './types'

export type WorkspaceConfigReadStatus =
  | { status: 'ok'; config: VnextWorkspaceConfig }
  | { status: 'missing' }
  | { status: 'invalid'; message: string }

export class WorkspaceAnalyzer {
  async analyze(rootPath: string, traceId?: string): Promise<WorkspaceAnalysisResult> {
    const [config, tree] = await Promise.all([
      this.tryReadConfig(rootPath, traceId),
      this.buildTree(rootPath, traceId),
    ])

    return {
      rootPath,
      config,
      configValid: config !== null,
      tree,
    }
  }

  async readConfig(rootPath: string, traceId?: string): Promise<VnextWorkspaceConfig> {
    try {
      const configPath = path.join(rootPath, CONFIG_FILE)
      const raw = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(raw) as VnextWorkspaceConfig
    } catch (error) {
      throw this.toAnalyzerError(error, 'WorkspaceAnalyzer.readConfig', traceId, { rootPath })
    }
  }

  async readConfigStatus(rootPath: string, traceId?: string): Promise<WorkspaceConfigReadStatus> {
    const configPath = path.join(rootPath, CONFIG_FILE)
    let raw: string
    try {
      raw = await fs.readFile(configPath, 'utf-8')
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code === 'ENOENT') {
        return { status: 'missing' }
      }
      throw this.toAnalyzerError(error, 'WorkspaceAnalyzer.readConfigStatus', traceId, { rootPath })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { status: 'invalid', message: 'vnext.config.json geçerli bir JSON dosyası değil.' }
    }

    const checked = workspaceRootConfigSchema.safeParse(parsed)
    if (!checked.success) {
      const fieldErrors = checked.error.issues
        .slice(0, 5)
        .map((i) => {
          const field = i.path.length > 0 ? i.path.join('.') : null
          return field ? `${field}: ${i.message}` : i.message
        })
      return {
        status: 'invalid',
        message: `vnext.config.json yapısı geçersiz:\n${fieldErrors.join('\n')}`,
      }
    }

    return { status: 'ok', config: normalizeWorkspaceRootToConfig(checked.data) }
  }

  async buildTree(rootPath: string, traceId?: string): Promise<FileTreeNode> {
    try {
      return this.walkDirectory(rootPath)
    } catch (error) {
      throw this.toAnalyzerError(error, 'WorkspaceAnalyzer.buildTree', traceId, { rootPath })
    }
  }

  private async tryReadConfig(
    rootPath: string,
    traceId?: string,
  ): Promise<VnextWorkspaceConfig | null> {
    try {
      return await this.readConfig(rootPath, traceId)
    } catch (error) {
      if (error instanceof VnextForgeError && error.code === ERROR_CODES.FILE_NOT_FOUND) {
        return null
      }
      if (error instanceof VnextForgeError && error.code === ERROR_CODES.PROJECT_INVALID_CONFIG) {
        return null
      }
      throw error
    }
  }

  private async walkDirectory(dirPath: string): Promise<FileTreeNode> {
    const stat = await fs.stat(dirPath)

    if (!stat.isDirectory()) {
      return {
        name: path.basename(dirPath),
        path: dirPath,
        type: 'file',
      }
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const children = await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => this.walkDirectory(path.join(dirPath, entry.name))),
    )

    return {
      name: path.basename(dirPath),
      path: dirPath,
      type: 'directory',
      children: children.sort((left, right) => {
        if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
        return left.name.localeCompare(right.name)
      }),
    }
  }

  private toAnalyzerError(
    error: unknown,
    source: string,
    traceId?: string,
    details?: Record<string, unknown>,
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

    const code = (error as NodeJS.ErrnoException | undefined)?.code

    if (code === 'ENOENT') {
      return new VnextForgeError(
        ERROR_CODES.FILE_NOT_FOUND,
        'Workspace file or directory was not found',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }

    if (code === 'EACCES' || code === 'EPERM') {
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
}
