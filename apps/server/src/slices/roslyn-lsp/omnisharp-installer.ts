import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import path from 'node:path'
import { baseLogger } from '@shared/lib/logger.js'

const execFileAsync = promisify(execFile)

const logger = baseLogger.child({ source: 'OmniSharpInstaller' })

let cachedPath: string | null = null

function getDefaultOmniSharpPath(): string {
  // dotnet global tools install to ~/.dotnet/tools on all platforms
  return path.join(homedir(), '.dotnet', 'tools', process.platform === 'win32' ? 'omnisharp.exe' : 'omnisharp')
}

async function isDotnetToolInstalled(toolName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('dotnet', ['tool', 'list', '-g'])
    return stdout.toLowerCase().includes(toolName.toLowerCase())
  } catch {
    return false
  }
}

async function installOmniSharpTool(): Promise<void> {
  logger.info('Installing OmniSharp dotnet tool globally...')
  try {
    await execFileAsync('dotnet', [
      'tool', 'install', '-g', 'omnisharp',
      '--version', '1.39.11',
    ])
    logger.info('OmniSharp installed successfully')
  } catch (err: any) {
    // If already installed, dotnet tool install fails with a specific message
    if (err?.stderr?.includes('already installed') || err?.stdout?.includes('already installed')) {
      logger.info('OmniSharp already installed')
      return
    }
    throw err
  }
}

/**
 * Ensures OmniSharp is available on the system.
 * Returns the path to the OmniSharp executable.
 * Result is cached after first successful resolution.
 */
export async function ensureOmniSharp(): Promise<string> {
  if (cachedPath) return cachedPath

  const defaultPath = getDefaultOmniSharpPath()

  // Check if already installed as dotnet global tool
  const isInstalled = await isDotnetToolInstalled('omnisharp')

  if (!isInstalled) {
    logger.warn('OmniSharp not found — attempting installation via dotnet tool')
    try {
      await installOmniSharpTool()
    } catch (err: any) {
      logger.error({ err }, 'Failed to install OmniSharp — Roslyn IntelliSense will be unavailable')
      throw new Error(`OmniSharp installation failed: ${err?.message ?? String(err)}`)
    }
  }

  cachedPath = defaultPath
  logger.info({ path: defaultPath }, 'OmniSharp resolved')
  return defaultPath
}
