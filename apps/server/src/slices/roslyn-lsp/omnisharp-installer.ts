import { execFile, exec } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir, platform, arch } from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { baseLogger } from '@shared/lib/logger.js'

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)

const logger = baseLogger.child({ source: 'OmniSharpInstaller' })

const OMNISHARP_VERSION = '1.39.11'
const OMNISHARP_INSTALL_DIR = path.join(homedir(), '.vnext-forge', 'omnisharp')

let cachedPath: string | null = null

// ── Platform detection ────────────────────────────────────────────────────────

type OmniSharpPlatform =
  | 'linux-x64'
  | 'linux-arm64'
  | 'osx-x64'
  | 'osx-arm64'
  | 'win-x64'

function detectPlatform(): OmniSharpPlatform {
  const os = platform()
  const cpu = arch()

  if (os === 'linux') return cpu === 'arm64' ? 'linux-arm64' : 'linux-x64'
  if (os === 'darwin') return cpu === 'arm64' ? 'osx-arm64' : 'osx-x64'
  if (os === 'win32') return 'win-x64'

  logger.warn({ os, cpu }, 'Unknown platform — defaulting to linux-x64')
  return 'linux-x64'
}

function getDownloadUrl(platformId: OmniSharpPlatform): string {
  const base = `https://github.com/OmniSharp/omnisharp-roslyn/releases/download/v${OMNISHARP_VERSION}`
  return `${base}/omnisharp-${platformId}-net6.0.tar.gz`
}

function getInstalledExecutable(): string {
  const ext = platform() === 'win32' ? '.exe' : ''
  return path.join(OMNISHARP_INSTALL_DIR, `OmniSharp${ext}`)
}

// ── Check candidates ──────────────────────────────────────────────────────────

/**
 * Checks if `OMNISHARP_PATH` env variable is set and points to a valid executable.
 */
async function checkEnvOverride(): Promise<string | null> {
  const envPath = process.env.OMNISHARP_PATH
  if (!envPath) return null

  try {
    await fs.access(envPath, fs.constants.X_OK)
    logger.info({ path: envPath }, 'OmniSharp found via OMNISHARP_PATH env')
    return envPath
  } catch {
    logger.warn({ path: envPath }, 'OMNISHARP_PATH is set but file is not executable or does not exist')
    return null
  }
}

/**
 * Checks if `omnisharp` or `OmniSharp` is available on the system PATH.
 */
async function checkSystemPath(): Promise<string | null> {
  const candidates = platform() === 'win32'
    ? ['omnisharp.exe', 'OmniSharp.exe']
    : ['omnisharp', 'OmniSharp']

  for (const name of candidates) {
    try {
      const { stdout } = await execAsync(
        platform() === 'win32' ? `where ${name}` : `which ${name}`,
      )
      const resolved = stdout.trim().split('\n')[0].trim()
      if (resolved) {
        logger.info({ path: resolved }, 'OmniSharp found on system PATH')
        return resolved
      }
    } catch { /* not found */ }
  }
  return null
}

/**
 * Checks if OmniSharp was previously downloaded to the vnext-forge install dir.
 */
async function checkLocalInstall(): Promise<string | null> {
  const exe = getInstalledExecutable()
  try {
    await fs.access(exe, fs.constants.X_OK)
    logger.info({ path: exe }, 'OmniSharp found in local install directory')
    return exe
  } catch {
    return null
  }
}

// ── Download ──────────────────────────────────────────────────────────────────

async function downloadOmniSharp(): Promise<string> {
  const platformId = detectPlatform()
  const url = getDownloadUrl(platformId)
  const exe = getInstalledExecutable()

  logger.info({ url, platformId, version: OMNISHARP_VERSION }, 'Downloading OmniSharp...')

  await fs.mkdir(OMNISHARP_INSTALL_DIR, { recursive: true })

  // Download the tar.gz using Node.js built-in fetch (Node 18+)
  const response = await fetch(url, {
    headers: { 'User-Agent': 'vnext-forge/1.0' },
    redirect: 'follow',
  })

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download OmniSharp: HTTP ${response.status} from ${url}`)
  }

  // Stream to a temp file then extract
  const tarPath = path.join(OMNISHARP_INSTALL_DIR, 'omnisharp.tar.gz')

  // Write the download to disk
  const dest = createWriteStream(tarPath)
  await pipeline(response.body as any, dest)

  logger.info({ tarPath }, 'OmniSharp archive downloaded, extracting...')

  // Extract the tar.gz
  await execFileAsync('tar', ['-xzf', tarPath, '-C', OMNISHARP_INSTALL_DIR])

  // Remove the archive
  await fs.unlink(tarPath).catch(() => undefined)

  // Make executable on unix
  if (platform() !== 'win32') {
    await execFileAsync('chmod', ['+x', exe])
  }

  logger.info({ path: exe }, 'OmniSharp installed successfully')
  return exe
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ensures OmniSharp is available and returns the path to the executable.
 *
 * Resolution order:
 *   1. `OMNISHARP_PATH` env variable (manual override)
 *   2. System PATH (`omnisharp` / `OmniSharp`)
 *   3. Previously downloaded to `~/.vnext-forge/omnisharp/`
 *   4. Auto-download from GitHub releases (v1.39.11)
 *
 * Result is cached after first successful resolution.
 */
export async function ensureOmniSharp(): Promise<string> {
  if (cachedPath) return cachedPath

  // 1. Env override
  const fromEnv = await checkEnvOverride()
  if (fromEnv) { cachedPath = fromEnv; return fromEnv }

  // 2. System PATH
  const fromPath = await checkSystemPath()
  if (fromPath) { cachedPath = fromPath; return fromPath }

  // 3. Local install cache
  const fromLocal = await checkLocalInstall()
  if (fromLocal) { cachedPath = fromLocal; return fromLocal }

  // 4. Auto-download
  logger.warn('OmniSharp not found — downloading from GitHub releases')
  try {
    const downloaded = await downloadOmniSharp()
    cachedPath = downloaded
    return downloaded
  } catch (err: any) {
    logger.error({ err }, 'OmniSharp download failed — Roslyn IntelliSense will be unavailable')
    throw new Error(
      `OmniSharp could not be installed automatically. ` +
      `Download it manually from https://github.com/OmniSharp/omnisharp-roslyn/releases ` +
      `and set the OMNISHARP_PATH environment variable to its location. ` +
      `(Original error: ${err?.message ?? String(err)})`,
    )
  }
}
