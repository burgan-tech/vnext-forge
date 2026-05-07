import { spawn, type ChildProcess } from 'node:child_process'

import type { LoggerAdapter } from '@vnext-forge-studio/services-core'
import type { LspServerType } from './omnisharp-installer.js'

// ── LSP Content-Length framing ───────────────────────────────────────────────

function readLspMessage(buffer: Buffer): { message: object; bytesConsumed: number } | null {
  const headerEnd = buffer.indexOf('\r\n\r\n')
  if (headerEnd === -1) return null

  const headerSection = buffer.subarray(0, headerEnd).toString('utf-8')
  const contentLengthMatch = /Content-Length:\s*(\d+)/i.exec(headerSection)
  if (!contentLengthMatch) return null

  const contentLength = parseInt(contentLengthMatch[1], 10)
  const bodyStart = headerEnd + 4
  const bodyEnd = bodyStart + contentLength

  if (buffer.length < bodyEnd) return null

  const body = buffer.subarray(bodyStart, bodyEnd).toString('utf-8')
  try {
    const message = JSON.parse(body) as object
    return { message, bytesConsumed: bodyEnd }
  } catch {
    return { message: {}, bytesConsumed: bodyEnd }
  }
}

function writeLspMessage(message: object): Buffer {
  const body = JSON.stringify(message)
  const header = `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n`
  return Buffer.from(header + body, 'utf-8')
}

export interface OmniSharpSession {
  readonly sessionId: string
  send(message: object): void
  onMessage(handler: (msg: object) => void): void
  dispose(): void
}

export interface StartOmniSharpDeps {
  logger: LoggerAdapter
}

/**
 * Spawns a Roslyn LSP server (csharp-ls or OmniSharp) bound to a workspace
 * folder and exposes a typed message-passing facade. The transport-agnostic
 * shell (WebSocket bridge in the web-server, postMessage bridge in the VS
 * Code extension) consumes this through {@link createLspBridge}.
 */
export function startOmniSharp(
  sessionId: string,
  workspacePath: string,
  executablePath: string,
  serverType: LspServerType,
  deps: StartOmniSharpDeps,
): OmniSharpSession {
  const { logger } = deps
  const messageHandlers: Array<(msg: object) => void> = []
  let receiveBuffer = Buffer.alloc(0)
  let disposed = false

  const args = serverType === 'csharp-ls'
    ? []
    : ['--languageserver', '-s', workspacePath, '--encoding', 'utf-8', '--loglevel', 'warning']

  const child: ChildProcess = spawn(executablePath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, DOTNET_NOLOGO: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1' },
  })

  logger.info({ sessionId, pid: child.pid, serverType }, 'LSP server process started')

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

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8').trim()
    if (text) logger.warn({ sessionId, omniSharpStderr: text }, 'LSP stderr')
  })

  child.on('exit', (code, signal) => {
    if (!disposed) {
      logger.warn({ sessionId, code, signal }, 'LSP process exited unexpectedly')
    }
  })

  child.on('error', (err) => {
    logger.error({ err, sessionId }, 'LSP process error')
  })

  return {
    sessionId,

    send(message: object): void {
      if (disposed || !child.stdin?.writable) return
      try {
        child.stdin.write(writeLspMessage(message))
      } catch (err) {
        logger.warn({ err, sessionId }, 'Failed to write to LSP stdin')
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
      logger.info({ sessionId }, 'LSP session disposed')
    },
  }
}
