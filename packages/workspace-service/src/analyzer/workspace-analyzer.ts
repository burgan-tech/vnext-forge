import fs from 'node:fs/promises'
import path from 'node:path'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import type { WorkspaceAnalysisResult } from '@analyzer/types.js'
import type { WorkspaceConfig } from '@interfaces/workspace.js'
import type { FileTreeNode } from '@interfaces/workspace-tree.js'
import { resolveConfigPath } from '@paths/resolver.js'

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined
}

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

  async readConfig(rootPath: string, traceId?: string): Promise<WorkspaceConfig> {
    const configPath = resolveConfigPath(rootPath)

    try {
      const raw = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(raw) as WorkspaceConfig
    } catch (error) {
      throw this.toAnalyzerError(error, {
        source: 'WorkspaceAnalyzer.readConfig',
        traceId,
        details: { rootPath, configPath },
      })
    }
  }

  async buildTree(rootPath: string, traceId?: string): Promise<FileTreeNode> {
    try {
      const stat = await fs.stat(rootPath)
      if (!stat.isDirectory()) {
        throw new VnextForgeError(
          ERROR_CODES.FILE_NOT_FOUND,
          'Workspace root is not a directory.',
          {
            source: 'WorkspaceAnalyzer.buildTree',
            layer: 'infrastructure',
            details: { rootPath },
          },
          traceId,
        )
      }

      return await this.walkDirectory(rootPath, path.basename(rootPath))
    } catch (error) {
      if (error instanceof VnextForgeError) {
        throw error
      }

      throw this.toAnalyzerError(error, {
        source: 'WorkspaceAnalyzer.buildTree',
        traceId,
        details: { rootPath },
      })
    }
  }

  private async tryReadConfig(rootPath: string, traceId?: string): Promise<WorkspaceConfig | null> {
    try {
      return await this.readConfig(rootPath, traceId)
    } catch (error) {
      if (error instanceof VnextForgeError) {
        const code = error.code
        if (code === ERROR_CODES.FILE_NOT_FOUND || code === ERROR_CODES.PROJECT_INVALID_CONFIG) {
          return null
        }
      }

      throw error
    }
  }

  private async walkDirectory(dirPath: string, name: string): Promise<FileTreeNode> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const children: FileTreeNode[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue
      }

      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        children.push(await this.walkDirectory(fullPath, entry.name))
      } else {
        children.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
        })
      }
    }

    children.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })

    return {
      name,
      path: dirPath,
      type: 'directory',
      children,
    }
  }

  private toAnalyzerError(
    error: unknown,
    input: {
      source: string
      traceId?: string
      details: Record<string, unknown>
    },
  ): VnextForgeError {
    if (error instanceof VnextForgeError) {
      return error
    }

    const code = getErrorCode(error)
    const details = {
      ...input.details,
      cause: error instanceof Error ? error.message : String(error),
    }

    if (error instanceof SyntaxError) {
      return new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'Workspace config could not be parsed.',
        {
          source: input.source,
          layer: 'infrastructure',
          details,
        },
        input.traceId,
      )
    }

    if (code === 'ENOENT') {
      return new VnextForgeError(
        ERROR_CODES.FILE_NOT_FOUND,
        'Workspace resource was not found.',
        {
          source: input.source,
          layer: 'infrastructure',
          details,
        },
        input.traceId,
      )
    }

    if (code === 'EACCES' || code === 'EPERM') {
      return new VnextForgeError(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        'Workspace resource could not be accessed.',
        {
          source: input.source,
          layer: 'infrastructure',
          details,
        },
        input.traceId,
      )
    }

    return new VnextForgeError(
      ERROR_CODES.PROJECT_LOAD_ERROR,
      'Workspace analysis failed.',
      {
        source: input.source,
        layer: 'infrastructure',
        details,
      },
      input.traceId,
    )
  }
}
