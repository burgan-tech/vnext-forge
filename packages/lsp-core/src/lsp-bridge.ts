import type { LoggerAdapter } from '@vnext-forge/services-core'

import {
  type LspWorkspace,
  type LspWorkspaceManager,
  getWrapOffset,
} from './lsp-workspace.js'
import {
  type OmniSharpInstaller,
} from './omnisharp-installer.js'
import { startOmniSharp, type OmniSharpSession } from './omnisharp-process.js'

/**
 * Generic transport contract used by every shell to ferry LSP frames between
 * the editor (Monaco webview) and the Roslyn process. Each shell only needs
 * to provide three operations; everything else lives in this package.
 */
export interface LspClientTransport {
  /** Send a fully-serialised JSON message to the editor side. */
  send(rawJson: string): void
  /** Close the editor-side channel with an optional reason. */
  close(code: number, reason: string): void
  /** Subscribe to incoming raw JSON messages from the editor side. */
  onMessage(handler: (rawJson: string) => void): void
  /** Subscribe to editor-side disconnects. */
  onClose(handler: () => void): void
}

interface BridgeSession {
  workspace: LspWorkspace
  lspServer: OmniSharpSession
  /** Monaco inmemory:// URI → workspace file:// URI used by the LSP server */
  clientToServer: Map<string, string>
  /** Normalised file:// URI → Monaco inmemory:// URI */
  serverToClient: Map<string, string>
  /** Lines prepended by wrapCsxContent for the active document, for diag shifts */
  wrapOffset: number
}

interface PendingSession {
  pending: true
  messageQueue: string[]
}

export interface LspBridgeDeps {
  logger: LoggerAdapter
  installer: OmniSharpInstaller
  workspaceManager: LspWorkspaceManager
}

/**
 * Build a transport-agnostic LSP bridge factory. Each shell calls
 * `bridge.connect(sessionId, transport)` for every editor session it wants
 * to back with Roslyn. The bridge owns:
 *   - URI translation (Monaco inmemory:// ↔ workspace file://)
 *   - Diagnostic line shifts caused by CSX wrapping
 *   - Buffered queueing while the workspace + dotnet restore boot up
 *   - Process / workspace teardown when the editor disconnects
 */
export function createLspBridge(deps: LspBridgeDeps) {
  const { logger, installer, workspaceManager } = deps
  const activeSessions = new Map<string, BridgeSession | PendingSession>()

  function scriptFileUri(workspace: LspWorkspace): string {
    const normalised = workspace.scriptPath.replace(/\\/g, '/')
    return normalised.startsWith('/') ? `file://${normalised}` : `file:///${normalised}`
  }

  function normalizeFileUri(uri: string): string {
    try {
      const decoded = decodeURIComponent(uri)
      return decoded.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '')
    } catch {
      return uri.toLowerCase()
    }
  }

  type LspMessage = {
    method?: string
    params?: Record<string, unknown> & {
      textDocument?: { uri?: string; text?: string }
      contentChanges?: Array<{ text?: string }>
      uri?: string
      diagnostics?: Array<{
        range?: {
          start?: { line?: number; character?: number }
          end?: { line?: number; character?: number }
        }
      }>
      rootUri?: string
      rootPath?: string
      workspaceFolders?: Array<{ uri: string; name: string }>
    }
  }

  /**
   * Expand a glob pattern that targets `*.cs` so it also matches `*.csx`.
   * csharp-ls / OmniSharp register their providers (didOpen, completion,
   * hover, file watchers, …) with `**\/*.cs` because that is the only file
   * extension Roslyn recognises out of the box. Without expansion, native
   * VS Code language clients silently drop notifications for `.csx` files
   * even though our document selector matches them — the LSP runtime honours
   * the server's dynamic registration filter on top of the client filter.
   *
   * Pure string transformation:
   *   `**\/*.cs`                        -> `**\/*.{cs,csx}`
   *   `**\/*.{cs,csproj,sln,slnx}`      -> `**\/*.{cs,csx,csproj,sln,slnx}`
   * Other patterns (no `cs` extension reference) are returned unchanged.
   */
  function expandCsxPattern(pattern: string): string {
    if (/(^|[/\\])\*\.cs$/.test(pattern)) {
      return pattern.replace(/(^|[/\\])\*\.cs$/, '$1*.{cs,csx}')
    }
    const braceMatch = /\{([^}]+)\}/.exec(pattern)
    if (braceMatch) {
      const exts = braceMatch[1].split(',').map((s) => s.trim())
      if (exts.includes('cs') && !exts.includes('csx')) {
        const next = [...exts]
        next.splice(next.indexOf('cs') + 1, 0, 'csx')
        return pattern.replace(braceMatch[0], `{${next.join(',')}}`)
      }
    }
    return pattern
  }

  /**
   * `client/registerCapability` requests come from csharp-ls/OmniSharp with
   * `pattern: '**\/*.cs'`. Rewrite each registration so `.csx` files are
   * also covered by didOpen/didChange/completion/hover/etc. — otherwise the
   * native VS Code LanguageClient skips our `.csx` documents entirely.
   * The Monaco webview client ignores this notification today, so this
   * change is a no-op for that transport.
   */
  function rewriteRegistrations(msg: LspMessage): LspMessage {
    if (msg.method !== 'client/registerCapability') return msg
    const registrations = msg.params?.registrations as Record<string, unknown>[] | undefined
    if (!Array.isArray(registrations)) return msg

    function mapFilter(filter: unknown): unknown {
      if (filter && typeof filter === 'object' && typeof (filter as { pattern?: unknown }).pattern === 'string') {
        const f = filter as { pattern: string }
        return { ...f, pattern: expandCsxPattern(f.pattern) }
      }
      return filter
    }

    function mapWatcher(watcher: unknown): unknown {
      if (
        watcher &&
        typeof watcher === 'object' &&
        typeof (watcher as { globPattern?: unknown }).globPattern === 'string'
      ) {
        const w = watcher as { globPattern: string }
        return { ...w, globPattern: expandCsxPattern(w.globPattern) }
      }
      return watcher
    }

    const next: Record<string, unknown>[] = registrations.map((reg) => {
      const opts = reg.registerOptions as Record<string, unknown> | undefined
      if (!opts) return reg
      const newOpts: Record<string, unknown> = { ...opts }
      const sel = opts.documentSelector
      if (Array.isArray(sel)) {
        newOpts.documentSelector = (sel as unknown[]).map(mapFilter)
      }
      const watchers = opts.watchers
      if (Array.isArray(watchers)) {
        newOpts.watchers = (watchers as unknown[]).map(mapWatcher)
      }
      return { ...reg, registerOptions: newOpts }
    })

    return {
      ...msg,
      params: { ...msg.params, registrations: next as unknown as never },
    }
  }

  function rewriteOutgoing(msg: LspMessage, session: BridgeSession): LspMessage {
    const uri = msg.params?.textDocument?.uri
    if (!uri) return msg

    const serverUri = session.clientToServer.get(uri)
    if (!serverUri) return msg

    return {
      ...msg,
      params: {
        ...msg.params,
        textDocument: { ...msg.params!.textDocument, uri: serverUri },
      },
    }
  }

  function rewriteIncoming(msg: LspMessage, session: BridgeSession): LspMessage {
    const uri = msg.params?.uri
    if (!uri) return msg

    const clientUri = session.serverToClient.get(normalizeFileUri(uri))
    if (!clientUri) return msg

    const rewritten: LspMessage = { ...msg, params: { ...msg.params, uri: clientUri } }

    if (msg.method === 'textDocument/publishDiagnostics' && session.wrapOffset > 0) {
      const offset = session.wrapOffset
      const shifted = (rewritten.params!.diagnostics ?? []).map((d) => ({
        ...d,
        range: {
          start: {
            line: Math.max(0, (d.range?.start?.line ?? 0) - offset),
            character: d.range?.start?.character ?? 0,
          },
          end: {
            line: Math.max(0, (d.range?.end?.line ?? 0) - offset),
            character: d.range?.end?.character ?? 0,
          },
        },
      }))
      rewritten.params = { ...rewritten.params!, diagnostics: shifted }
    }

    return rewritten
  }

  async function connect(sessionId: string, transport: LspClientTransport): Promise<void> {
    logger.info({ sessionId }, 'LSP client connected')

    activeSessions.set(sessionId, { pending: true, messageQueue: [] })

    transport.onMessage((raw) => handleMessage(sessionId, raw))
    transport.onClose(() => {
      void disconnect(sessionId)
    })

    let serverInfo
    try {
      serverInfo = await installer.ensureLspServer()
    } catch (err) {
      logger.error({ err, sessionId }, 'No LSP server available — closing channel')
      activeSessions.delete(sessionId)
      transport.close(1011, 'LSP server unavailable')
      return
    }

    let workspace: LspWorkspace
    try {
      workspace = await workspaceManager.createLspWorkspace(sessionId)
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to create LSP workspace — closing channel')
      activeSessions.delete(sessionId)
      transport.close(1011, 'Workspace creation failed')
      return
    }

    const lspServer = startOmniSharp(
      sessionId,
      workspace.workspacePath,
      serverInfo.executablePath,
      serverInfo.serverType,
      { logger },
    )

    const session: BridgeSession = {
      workspace,
      lspServer,
      clientToServer: new Map(),
      serverToClient: new Map(),
      wrapOffset: 0,
    }

    lspServer.onMessage((rawMsg) => {
      try {
        const incoming = rawMsg as LspMessage
        if (incoming.method === 'textDocument/publishDiagnostics') {
          logger.info(
            {
              sessionId,
              uri: incoming.params?.uri,
              count: incoming.params?.diagnostics?.length ?? 0,
            },
            'publishDiagnostics received from LSP server',
          )
        }
        let msg = rewriteIncoming(incoming, session)
        msg = rewriteRegistrations(msg)
        if (msg.method === 'textDocument/publishDiagnostics') {
          logger.info(
            {
              sessionId,
              uri: msg.params?.uri,
              count: msg.params?.diagnostics?.length ?? 0,
            },
            'publishDiagnostics forwarded to client',
          )
        }
        transport.send(JSON.stringify(msg))
      } catch (err) {
        logger.warn({ err, sessionId }, 'Failed to forward LSP message to client')
      }
    })

    const pendingEntry = activeSessions.get(sessionId)
    if (!pendingEntry) {
      logger.info({ sessionId }, 'Client disconnected during LSP setup — aborting')
      lspServer.dispose()
      await workspaceManager.destroyLspWorkspace(workspace)
      return
    }
    const queued = 'pending' in pendingEntry ? pendingEntry.messageQueue : []

    activeSessions.set(sessionId, session)

    if (queued.length > 0) {
      logger.info({ sessionId, count: queued.length }, 'Flushing queued LSP messages')
      for (const raw of queued) {
        processLspMessage(session, raw)
      }
    }
  }

  function processLspMessage(session: BridgeSession, rawMessage: string): void {
    const { sessionId } = session.lspServer

    let msg: LspMessage
    try {
      msg = JSON.parse(rawMessage) as LspMessage
    } catch {
      logger.warn({ sessionId }, 'Received malformed JSON from LSP client')
      return
    }

    if (msg.method === 'initialize' && msg.params) {
      const workspaceUri = `file://${session.workspace.workspacePath.replace(/\\/g, '/')}`
      msg = {
        ...msg,
        params: {
          ...msg.params,
          rootUri: workspaceUri,
          rootPath: session.workspace.workspacePath,
          workspaceFolders: [{ uri: workspaceUri, name: 'vnext-script' }],
        },
      }
    }

    if (msg.method === 'textDocument/didOpen' && msg.params?.textDocument?.uri) {
      const clientUri = msg.params.textDocument.uri
      const serverUri = scriptFileUri(session.workspace)

      if (!session.clientToServer.has(clientUri)) {
        session.clientToServer.set(clientUri, serverUri)
        session.serverToClient.set(normalizeFileUri(serverUri), clientUri)
        logger.info({ sessionId, clientUri, serverUri }, 'LSP document URI mapping registered')
      }

      const text = msg.params.textDocument.text
      if (text !== undefined) {
        session.wrapOffset = getWrapOffset(text)
        workspaceManager.updateScriptContent(session.workspace, text).catch((err) =>
          logger.warn({ err, sessionId }, 'Failed to mirror opened document'),
        )
      }

      msg = rewriteOutgoing(msg, session)
    }

    if (msg.method === 'textDocument/didChange') {
      const clientUri = msg.params?.textDocument?.uri
      if (clientUri) {
        const serverUri = session.clientToServer.get(clientUri)
        if (serverUri) session.serverToClient.set(normalizeFileUri(serverUri), clientUri)
      }
      const text = msg.params?.contentChanges?.[0]?.text
      if (text !== undefined) {
        session.wrapOffset = getWrapOffset(text)
        workspaceManager.updateScriptContent(session.workspace, text).catch((err) =>
          logger.warn({ err, sessionId }, 'Failed to mirror script content'),
        )
      }
      msg = rewriteOutgoing(msg, session)
    }

    if (
      msg.method?.startsWith('textDocument/') &&
      msg.method !== 'textDocument/didOpen' &&
      msg.method !== 'textDocument/didChange'
    ) {
      msg = rewriteOutgoing(msg, session)
    }

    session.lspServer.send(msg)
  }

  function handleMessage(sessionId: string, rawMessage: string): void {
    const entry = activeSessions.get(sessionId)
    if (!entry) return

    if ('pending' in entry) {
      entry.messageQueue.push(rawMessage)
      return
    }

    processLspMessage(entry, rawMessage)
  }

  async function disconnect(sessionId: string): Promise<void> {
    logger.info({ sessionId }, 'LSP client disconnected')

    const entry = activeSessions.get(sessionId)
    if (!entry) return

    activeSessions.delete(sessionId)

    if ('pending' in entry) return

    entry.lspServer.dispose()
    await workspaceManager.destroyLspWorkspace(entry.workspace)
  }

  return { connect, disconnect, handleMessage }
}

export type LspBridge = ReturnType<typeof createLspBridge>
