import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import type { VnextWorkspaceConfig, VnextWorkspacePaths } from '@workspace/types.js'

const require = createRequire(import.meta.url)

const DEFAULT_TEMPLATE_PATHS: Record<string, string> = {
  tasks: 'Tasks',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
  workflows: 'Workflows',
  schemas: 'Schemas',
}

function getInitScriptPath(): string {
  return require.resolve('@burgan-tech/vnext-template/init.js')
}

function runInitScript(targetDir: string, domainName: string): Promise<string> {
  const initScript = getInitScriptPath()

  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [initScript, domainName],
      {
        cwd: targetDir,
        timeout: 120_000,
        env: { ...process.env, npm_config_yes: 'true' },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `vnext-template init failed: ${error.message}\nstdout: ${stdout}\nstderr: ${stderr}`,
            ),
          )
          return
        }
        resolve(stdout)
      },
    )
  })
}

export class TemplateService {
  /**
   * `npx @burgan-tech/vnext-template <domain-name>` ile ayni sekilde proje olusturur.
   * init.js'i dogrudan calistirir: dosya kopyalama, placeholder replacement ve npm install yapar.
   */
  async scaffoldFromTemplate(
    targetDir: string,
    domainName: string,
    traceId?: string,
  ): Promise<{ output: string }> {
    const initScript = getInitScriptPath()

    try {
      await fs.stat(initScript)
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.INTERNAL_UNEXPECTED,
        'vnext-template init.js not found',
        {
          source: 'TemplateService.scaffoldFromTemplate',
          layer: 'infrastructure',
          details: { initScript },
        },
        traceId,
      )
    }

    await fs.mkdir(targetDir, { recursive: true })

    try {
      const output = await runInitScript(targetDir, domainName)
      return { output }
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_SAVE_ERROR,
        `vnext-template ile proje oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`,
        {
          source: 'TemplateService.scaffoldFromTemplate',
          layer: 'infrastructure',
          details: { targetDir, domainName },
        },
        traceId,
      )
    }
  }

  /**
   * Template'in default vnext.config.json ve klasor isimlerini
   * kullanicinin custom config'ine gore override eder.
   */
  async applyCustomConfig(
    targetDir: string,
    domainName: string,
    customConfig: VnextWorkspaceConfig,
    traceId?: string,
  ): Promise<void> {
    const domainDir = path.join(targetDir, domainName)

    const pathKeys = Object.keys(DEFAULT_TEMPLATE_PATHS) as (keyof Omit<VnextWorkspacePaths, 'componentsRoot'>)[]
    for (const key of pathKeys) {
      const defaultFolder = DEFAULT_TEMPLATE_PATHS[key]
      const customFolder = customConfig.paths[key]?.trim()
      if (!customFolder || customFolder === defaultFolder) continue

      const oldPath = path.join(domainDir, defaultFolder)
      const newPath = path.join(domainDir, customFolder)
      try {
        await fs.stat(oldPath)
        await fs.rename(oldPath, newPath)
      } catch {
        await fs.mkdir(newPath, { recursive: true })
      }
    }

    if (customConfig.paths.componentsRoot !== domainName) {
      const oldRoot = domainDir
      const newRoot = path.join(targetDir, customConfig.paths.componentsRoot)
      if (oldRoot !== newRoot) {
        try {
          await fs.stat(oldRoot)
          await fs.rename(oldRoot, newRoot)
        } catch {
          await fs.mkdir(newRoot, { recursive: true })
        }
      }
    }

    const configPath = path.join(targetDir, 'vnext.config.json')
    await fs.writeFile(configPath, JSON.stringify(customConfig, null, 2), 'utf8')
  }

  async checkValidateScript(projectPath: string): Promise<{ exists: boolean }> {
    const validatePath = path.join(projectPath, 'validate.js')
    try {
      await fs.stat(validatePath)
      return { exists: true }
    } catch {
      return { exists: false }
    }
  }
}
