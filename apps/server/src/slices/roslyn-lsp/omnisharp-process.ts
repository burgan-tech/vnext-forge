import { spawn, type ChildProcess } from 'node:child_process'
import { baseLogger } from '@shared/lib/logger.js'

const logger = baseLogger.child({ source: 'OmniSharpProcess' })

// ── LSP Content-Length framing ────────────────────────────────────────────────

/**
 * Reads a single LSP message from a buffer using Content-Length framing.
 * Returns the parsed JSON object and the number of bytes consumed,
 * or null if there's not enough data yet.
 */
function readLspMessage(buffer: Buffer): { message: object; bytesConsumed: number } | null {
  const headerEnd = buffer.indexOf('\r\n\r\n')
  if (headerEnd === -1) return null

  const headerSection = buffer.subarray(0, headerEnd).toString('utf-8')
  const contentLengthMatch = headerSection.match(/Content-Length:\s*(\d+)/i)
  if (!contentLengthMatch) return null

  const contentLength = parseInt(contentLengthMatch[1], 10)
  const bodyStart = headerEnd + 4 // skip \r\n\r\n
  const bodyEnd = bodyStart + contentLength

  if (buffer.length < bodyEnd) return null // not enough data yet

  const body = buffer.subarray(bodyStart, bodyEnd).toString('utf-8')
  try {
    const message = JSON.parse(body) as object
    return { message, bytesConsumed: bodyEnd }
  } catch {
    // Malformed JSON — skip this frame
    return { message: {}, bytesConsumed: bodyEnd }
  }
}

/**
 * Serializes a JSON object into an LSP Content-Length framed message.
 */
function writeLspMessage(message: object): Buffer {
  const body = JSON.stringify(message)
  const header = `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n`
  return Buffer.from(header + body, 'utf-8')
}

// ── OmniSharp session ─────────────────────────────────────────────────────────

export interface OmniSharpSession {
  readonly sessionId: string
  send(message: object): void
  onMessage(handler: (msg: object) => void): void
  dispose(): void
}

/**
 * Spawns an OmniSharp child process in LSP mode for the given workspace.
 * Returns a session object that wraps stdio communication.
 */
export function startOmniSharp(
  sessionId: string,
  workspacePath: string,
  omnisharpPath: string,
): OmniSharpSession {
  const messageHandlers: Array<(msg: object) => void> = []
  let receiveBuffer = Buffer.alloc(0)
  let disposed = false

  const child: ChildProcess = spawn(
    omnisharpPath,
    [
      '--languageserver',
      '-s', workspacePath,
      '--encoding', 'utf-8',
      '--loglevel', 'warning',
    ],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DOTNET_NOLOGO: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1' },
    },
  )

  logger.info({ sessionId, pid: child.pid }, 'OmniSharp process started')

  // ── stdout: accumulate and parse LSP frames ───────────────────────────────

  child.stdout?.on('data', (chunk: Buffer) => {
    receiveBuffer = Buffer.concat([receiveBuffer, chunk])

    let parsed = readLspMessage(receiveBuffer)
    while (parsed !== null) {
      receiveBuffer = receiveBuffer.subarray(parsed.bytesConsumed)
      const msg = parsed.message
      for (const handler of messageHandlers) {
        try { handler(msg) } catch { /* handler errors must not crash the bridge */ }
      }
      parsed = readLspMessage(receiveBuffer)
    }
  })

  // ── stderr: log warnings from OmniSharp ──────────────────────────────────

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8').trim()
    if (text) logger.warn({ sessionId, omniSharpStderr: text }, 'OmniSharp stderr')
  })

  // ── process exit ─────────────────────────────────────────────────────────

  child.on('exit', (code, signal) => {
    if (!disposed) {
      logger.warn({ sessionId, code, signal }, 'OmniSharp process exited unexpectedly')
    }
  })

  child.on('error', (err) => {
    logger.error({ err, sessionId }, 'OmniSharp process error')
  })

  // ── session interface ─────────────────────────────────────────────────────

  return {
    sessionId,

    send(message: object): void {
      if (disposed || !child.stdin?.writable) return
      try {
        child.stdin.write(writeLspMessage(message))
      } catch (err) {
        logger.warn({ err, sessionId }, 'Failed to write to OmniSharp stdin')
      }
    },

    onMessage(handler: (msg: object) => void): void {
      messageHandlers.push(handler)
    },

    dispose(): void {
      if (disposed) return
      disposed = true
      messageHandlers.length = 0
      try {
        child.stdin?.end()
        child.kill('SIGTERM')
      } catch { /* process may already be gone */ }
      logger.info({ sessionId }, 'OmniSharp session disposed')
    },
  }
}
