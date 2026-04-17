import { execFile, exec } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir, platform, arch } from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { baseLogger } from '@ext/shared/logger'

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)

const logger = baseLogger.child({ source: 'LspInstaller' })

const OMNISHARP_VERSION = '1.39.11'
const INSTALL_DIR = path.join(homedir(), '.vnext-forge', 'omnisharp')

// ── Result type ───────────────────────────────────────────────────────────────

export type LspServerType = 'csharp-ls' | 'omnisharp'

export interface LspServerInfo {
  executablePath: string
  serverType: LspServerType
}

let cached: LspServerInfo | null = null

// ── csharp-ls detection ───────────────────────────────────────────────────────

async function findCsharpLs(): Promise<string | null> {
  const envPath = process.env.CSHARP_LS_PATH
  if (envPath) {
    try {
      await fs.access(envPath, fs.constants.X_OK)
      return envPath
    } catch { /* not accessible */ }
  }

  for (const name of ['csharp-ls', 'csharp_ls']) {
    try {
      const { stdout } = await execAsync(
        platform() === 'win32' ? `where ${name}` : `which ${name}`,
      )
      const resolved = stdout.trim().split('\n')[0].trim()
      if (resolved) return resolved
    } catch { /* not found */ }
  }

  const dotnetToolsDir = path.join(homedir(), '.dotnet', 'tools')
  const toolName = platform() === 'win32' ? 'csharp-ls.exe' : 'csharp-ls'
  const toolPath = path.join(dotnetToolsDir, toolName)
  try {
    await fs.access(toolPath, fs.constants.X_OK)
    return toolPath
  } catch { /* not installed */ }

  return null
}

async function installCsharpLs(): Promise<string | null> {
  logger.info('Installing csharp-ls via dotnet tool...')
  try {
    await execFileAsync('dotnet', ['tool', 'install', '-g', 'csharp-ls'])
    logger.info('csharp-ls installed successfully')
    return await findCsharpLs()
  } catch (err: any) {
    if (err?.stderr?.includes('already installed') || err?.stdout?.includes('already installed')) {
      logger.info('csharp-ls already installed')
      return await findCsharpLs()
    }
    logger.warn({ err: err?.message }, 'csharp-ls installation failed')
    return null
  }
}

// ── OmniSharp detection + self-contained download ─────────────────────────────

type OmniSharpPlatformId = 'linux-x64' | 'linux-arm64' | 'osx' | 'win-x64'

function detectOmniSharpPlatform(): OmniSharpPlatformId {
  const os = platform()
  const cpu = arch()
  if (os === 'linux') return cpu === 'arm64' ? 'linux-arm64' : 'linux-x64'
  if (os === 'darwin') return 'osx'
  return 'win-x64'
}

function getOmniSharpDownloadUrl(platformId: OmniSharpPlatformId): string {
  const base = `https://github.com/OmniSharp/omnisharp-roslyn/releases/download/v${OMNISHARP_VERSION}`
  return `${base}/omnisharp-${platformId}.zip`
}

function getInstalledOmniSharpExecutable(): string {
  return path.join(INSTALL_DIR, platform() === 'win32' ? 'OmniSharp.exe' : 'OmniSharp')
}

async function checkOmniSharpEnvOverride(): Promise<string | null> {
  const envPath = process.env.OMNISHARP_PATH
  if (!envPath) return null
  try {
    await fs.access(envPath, fs.constants.X_OK)
    return envPath
  } catch {
    logger.warn({ path: envPath }, 'OMNISHARP_PATH set but file not accessible')
    return null
  }
}

async function findOmniSharpOnPath(): Promise<string | null> {
  const candidates = platform() === 'win32'
    ? ['omnisharp.exe', 'OmniSharp.exe']
    : ['omnisharp', 'OmniSharp']
  for (const name of candidates) {
    try {
      const { stdout } = await execAsync(
        platform() === 'win32' ? `where ${name}` : `which ${name}`,
      )
      const resolved = stdout.trim().split('\n')[0].trim()
      if (resolved) return resolved
    } catch { /* not found */ }
  }
  return null
}

async function findCachedOmniSharp(): Promise<string | null> {
  const exe = getInstalledOmniSharpExecutable()
  try {
    await fs.access(exe, fs.constants.X_OK)
    return exe
  } catch {
    return null
  }
}

async function downloadOmniSharp(): Promise<string> {
  const platformId = detectOmniSharpPlatform()
  const url = getOmniSharpDownloadUrl(platformId)
  const exe = getInstalledOmniSharpExecutable()

  logger.info({ url, platformId, version: OMNISHARP_VERSION }, 'Downloading OmniSharp (self-contained)...')

  await fs.mkdir(INSTALL_DIR, { recursive: true })

  const response = await fetch(url, {
    headers: { 'User-Agent': 'vnext-forge/1.0' },
    redirect: 'follow',
  })

  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} downloading OmniSharp from ${url}`)
  }

  const zipPath = path.join(INSTALL_DIR, 'omnisharp.zip')
  const dest = createWriteStream(zipPath)
  await pipeline(response.body as any, dest)

  logger.info({ zipPath }, 'OmniSharp archive downloaded, extracting...')

  await execFileAsync('unzip', ['-o', zipPath, '-d', INSTALL_DIR])
  await fs.unlink(zipPath).catch(() => undefined)

  if (platform() !== 'win32') {
    await execFileAsync('chmod', ['+x', exe]).catch(() => undefined)
  }

  logger.info({ path: exe }, 'OmniSharp installed')
  return exe
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function ensureOmniSharp(): Promise<LspServerInfo> {
  if (cached) return cached

  const csLsPath = await findCsharpLs()
  if (csLsPath) {
    logger.info({ path: csLsPath }, 'Using csharp-ls as LSP server')
    cached = { executablePath: csLsPath, serverType: 'csharp-ls' }
    return cached
  }

  const installed = await installCsharpLs()
  if (installed) {
    logger.info({ path: installed }, 'Using csharp-ls (just installed) as LSP server')
    cached = { executablePath: installed, serverType: 'csharp-ls' }
    return cached
  }

  logger.info('csharp-ls not available — falling back to OmniSharp')

  const fromEnv = await checkOmniSharpEnvOverride()
  if (fromEnv) {
    cached = { executablePath: fromEnv, serverType: 'omnisharp' }
    return cached
  }

  const fromPath = await findOmniSharpOnPath()
  if (fromPath) {
    cached = { executablePath: fromPath, serverType: 'omnisharp' }
    return cached
  }

  const fromLocal = await findCachedOmniSharp()
  if (fromLocal) {
    cached = { executablePath: fromLocal, serverType: 'omnisharp' }
    return cached
  }

  logger.warn('OmniSharp not found — downloading self-contained build from GitHub releases')
  try {
    const downloaded = await downloadOmniSharp()
    cached = { executablePath: downloaded, serverType: 'omnisharp' }
    return cached
  } catch (err: any) {
    throw new Error(
      `No C# LSP server found. Options:\n` +
      `  • dotnet tool install -g csharp-ls   (recommended, requires .NET SDK)\n` +
      `  • Set OMNISHARP_PATH=/path/to/OmniSharp  (manual override)\n` +
      `  Original error: ${err?.message ?? String(err)}`,
    )
  }
}
