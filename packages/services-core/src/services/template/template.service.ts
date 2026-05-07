import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import { z } from 'zod'

import type {
  FileSystemAdapter,
  LoggerAdapter,
  ProcessAdapter,
} from '../../adapters/index.js'
import { joinPosix } from '../../internal/paths.js'
import type {
  VnextWorkspaceConfig,
  VnextWorkspacePaths,
} from '../workspace/types.js'

const DEFAULT_TEMPLATE_PATHS: Record<string, string> = {
  tasks: 'Tasks',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
  workflows: 'Workflows',
  schemas: 'Schemas',
}

export interface TemplateInitScriptResolver {
  /** Returns the absolute filesystem path to the bundled vnext-template `init.js`. */
  resolve(): string
}

export interface TemplateServiceDeps {
  fs: FileSystemAdapter
  process: ProcessAdapter
  logger: LoggerAdapter
  initScriptResolver: TemplateInitScriptResolver
}

// ── zod schemas ──────────────────────────────────────────────────────────────

export const templatesValidateScriptParams = z.object({
  projectPath: z.string().min(1),
})
export const templatesValidateScriptResult = z.object({ exists: z.boolean() })

export function createTemplateService(deps: TemplateServiceDeps) {
  const { fs, process: proc, initScriptResolver } = deps

  async function ensureInitScriptAvailable(traceId?: string): Promise<string> {
    const initScript = initScriptResolver.resolve()
    const exists = await fs.exists(initScript)
    if (!exists) {
      throw new VnextForgeError(
        ERROR_CODES.INTERNAL_UNEXPECTED,
        'vnext-template init.js not found',
        {
          source: 'TemplateService.ensureInitScriptAvailable',
          layer: 'infrastructure',
          details: { initScript },
        },
        traceId,
      )
    }
    return initScript
  }

  async function scaffoldFromTemplate(
    targetDir: string,
    domainName: string,
    traceId?: string,
  ): Promise<{ output: string }> {
    const initScript = await ensureInitScriptAvailable(traceId)
    await fs.mkdir(targetDir, { recursive: true })
    try {
      const { stdout } = await proc.runNode({
        scriptPath: initScript,
        scriptArgs: [domainName],
        cwd: targetDir,
        timeoutMs: 120_000,
        env: { npm_config_yes: 'true' },
      })
      return { output: stdout }
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_SAVE_ERROR,
        `vnext-template scaffold failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          source: 'TemplateService.scaffoldFromTemplate',
          layer: 'infrastructure',
          details: { targetDir, domainName },
        },
        traceId,
      )
    }
  }

  async function applyCustomConfig(
    targetDir: string,
    domainName: string,
    customConfig: VnextWorkspaceConfig,
    traceId?: string,
  ): Promise<void> {
    const domainDir = joinPosix(targetDir, domainName)

    const pathKeys = Object.keys(DEFAULT_TEMPLATE_PATHS) as (keyof Omit<VnextWorkspacePaths, 'componentsRoot'>)[]
    for (const key of pathKeys) {
      const defaultFolder = DEFAULT_TEMPLATE_PATHS[key]
      const customFolder = customConfig.paths[key]?.trim()
      if (!customFolder || customFolder === defaultFolder) continue

      const oldPath = joinPosix(domainDir, defaultFolder)
      const newPath = joinPosix(domainDir, customFolder)
      const exists = await fs.exists(oldPath)
      if (exists) {
        await fs.rename(oldPath, newPath)
      } else {
        await fs.mkdir(newPath, { recursive: true })
      }
    }

    if (customConfig.paths.componentsRoot !== domainName) {
      const oldRoot = domainDir
      const newRoot = joinPosix(targetDir, customConfig.paths.componentsRoot)
      if (oldRoot !== newRoot) {
        const exists = await fs.exists(oldRoot)
        if (exists) {
          await fs.rename(oldRoot, newRoot)
        } else {
          await fs.mkdir(newRoot, { recursive: true })
        }
      }
    }

    const configPath = joinPosix(targetDir, 'vnext.config.json')
    await fs.writeFile(configPath, JSON.stringify(customConfig, null, 2))
    void traceId
  }

  async function checkValidateScript(projectPath: string): Promise<{ exists: boolean }> {
    const validatePath = joinPosix(projectPath, 'validate.js')
    return { exists: await fs.exists(validatePath) }
  }

  return { scaffoldFromTemplate, applyCustomConfig, checkValidateScript }
}

export type TemplateService = ReturnType<typeof createTemplateService>
