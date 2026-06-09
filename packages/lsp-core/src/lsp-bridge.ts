import type { LoggerAdapter } from '@vnext-forge-studio/services-core'

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
  /**
   * Per-client-URI cache of last known text. We keep one `Script.cs` on the
   * server side and time-slice it across all open `.csx` files — when the
   * user switches focus we replay didClose/didOpen with the target file's
   * cached content so the server's view matches the client's active editor.
   * Without this, opening multiple `.csx` files (e.g. several state scripts
   * inside the same workflow folder) made QuickFix edits land on whichever
   * file's didOpen happened to fire last, not the one the user was viewing.
   */
  contentByClientUri: Map<string, string>
  /** Last known LSP version per client URI (for synthetic didOpen on switch) */
  versionByClientUri: Map<string, number>
  /** Last known LSP languageId per client URI */
  languageIdByClientUri: Map<string, string>
  /** Wrap offset for each cached client URI (so diag shifts stay correct on switch) */
  wrapOffsetByClientUri: Map<string, number>
  /** Which client URI is currently mirrored to `Script.cs` on the server, if any */
  currentClientUri: string | null
  /** Monotonically incrementing version we hand to the server on synthetic didOpens */
  serverDocVersion: number
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
   * Narrow a glob pattern that targets `*.cs` (and related project
   * extensions) so it ONLY matches `*.csx`.
   *
   * csharp-ls / OmniSharp register their providers (didOpen, completion,
   * hover, file watchers, …) with `**\/*.cs` because that is the only
   * file extension Roslyn recognises out of the box. The native VS Code
   * LanguageClient applies the server's dynamic registration filters on
   * top of the client-side `documentSelector`, so we must rewrite these
   * patterns or the client either skips our `.csx` files (no rewrite)
   * or starts forwarding every `.cs` file in the user's workspace —
   * e.g. a sibling integration-test project — into our `.csx`-only LSP,
   * which then runs Roslyn over code it was never asked to analyse.
   *
   * Pure string transformation:
   *   `**\/*.cs`                        -> `**\/*.csx`
   *   `**\/*.{cs,csproj,sln,slnx}`      -> `**\/*.csx`
   *   `**\/*.{cs,csx,csproj,sln,slnx}`  -> `**\/*.csx`
   * Other patterns (no `cs`/`csx` reference) are returned unchanged.
   *
   * We deliberately drop `csproj` / `sln` / `slnx` watchers: the only
   * project file our session ever sees is `/tmp/vnext-lsp/<id>/session.csproj`
   * which the host owns. The user's workspace projects must stay off
   * the analyzer's radar entirely.
   */
  function expandCsxPattern(pattern: string): string {
    if (/(^|[/\\])\*\.csx?$/.test(pattern)) {
      return pattern.replace(/(^|[/\\])\*\.csx?$/, '$1*.csx')
    }
    const braceMatch = /\{([^}]+)\}/.exec(pattern)
    if (braceMatch) {
      const exts = braceMatch[1].split(',').map((s) => s.trim())
      if (exts.includes('cs') || exts.includes('csx')) {
        // Replace the whole brace group with just `csx` — never let
        // the analyzer subscribe to plain `.cs` / `.csproj` / `.sln`.
        return pattern.replace(braceMatch[0], 'csx')
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
    // First swap the canonical `params.textDocument.uri` for the cheap
    // path covering didOpen/didChange/completion/hover/etc.
    let result = msg
    const uri = msg.params?.textDocument?.uri
    if (uri) {
      const serverUri = session.clientToServer.get(uri)
      if (serverUri) {
        result = {
          ...msg,
          params: {
            ...msg.params,
            textDocument: { ...msg.params!.textDocument, uri: serverUri },
          },
        }
      }
    }
    // Then deep-walk for nested client URIs that the server-side
    // expects in its own coordinate system. `codeAction/resolve` is
    // the canonical case: the client sends back the unresolved
    // CodeAction (which we previously rewrote to client URIs in
    // `rewriteIncoming`), and csharp-ls / OmniSharp can't look it
    // up because the URI doesn't match anything it indexed —
    // resulting in `Internal error: Exception` from `resolve`.
    // Also covers WorkspaceEdit echoes (`workspace/applyEdit`
    // response from client → server) and any future request that
    // ferries a URI inside a non-canonical position.
    const deep = rewriteUrisDeep(result, session, 'clientToServer') as LspMessage
    return deep
  }

  /**
   * Walk an arbitrary value and rewrite any `uri` / `oldUri` / `newUri`
   * string field whose value matches a known server-side URI, swapping
   * it for the corresponding client URI. This is what lets QuickFix /
   * `workspace/applyEdit` / code-action responses target the user's
   * actual `.csx` file instead of `/tmp/vnext-lsp/<id>/Script.cs`.
   *
   * The walk is intentionally generic — LSP's `WorkspaceEdit` shape
   * varies between servers and versions (`changes` map, `documentChanges`
   * array with `TextDocumentEdit | CreateFile | RenameFile | DeleteFile`),
   * and code actions can nest WorkspaceEdit inside `edit` or behind a
   * resolver. Walking everything is cheaper than enumerating shapes.
   *
   * Returns a new value with rewrites applied; original is unchanged.
   */
  function rewriteUrisDeep(
    value: unknown,
    session: BridgeSession,
    direction: 'serverToClient' | 'clientToServer',
  ): unknown {
    const map = direction === 'serverToClient' ? session.serverToClient : session.clientToServer
    const lookup = (uri: string): string | undefined => {
      if (!/^file:/i.test(uri)) return undefined
      // Server→client map keys are normalized; client→server map keys are
      // the verbatim client URI we observed in `didOpen`. Try both forms
      // so we don't miss a hit when casing / trailing slashes differ.
      return (
        map.get(uri) ??
        (direction === 'serverToClient' ? map.get(normalizeFileUri(uri)) : undefined)
      )
    }
    if (value === null || value === undefined) return value
    if (typeof value === 'string') {
      const swapped = lookup(value)
      return swapped ?? value
    }
    if (Array.isArray(value)) {
      let changed = false
      const next = value.map((item) => {
        const rw = rewriteUrisDeep(item, session, direction)
        if (rw !== item) changed = true
        return rw
      })
      return changed ? next : value
    }
    if (typeof value === 'object') {
      const src = value as Record<string, unknown>
      let changed = false
      const dst: Record<string, unknown> = {}
      for (const [key, raw] of Object.entries(src)) {
        // `changes` is `{ [uri]: TextEdit[] }`: rewrite map keys too.
        if (key === 'changes' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const mapped: Record<string, unknown> = {}
          let mapChanged = false
          for (const [uri, edits] of Object.entries(raw as Record<string, unknown>)) {
            const swapped = lookup(uri)
            const nextUri = swapped ?? uri
            if (swapped) mapChanged = true
            const nextEdits = rewriteUrisDeep(edits, session, direction)
            if (nextEdits !== edits) mapChanged = true
            mapped[nextUri] = nextEdits
          }
          dst[key] = mapChanged ? mapped : raw
          if (mapChanged) changed = true
          continue
        }
        const rw = rewriteUrisDeep(raw, session, direction)
        if (rw !== raw) changed = true
        dst[key] = rw
      }
      return changed ? dst : value
    }
    return value
  }

  function rewriteIncoming(msg: LspMessage, session: BridgeSession): LspMessage {
    // Server → client edits / code actions: walk the whole message and
    // rewrite every server-side URI we know about. This covers
    // `workspace/applyEdit` (server request) and code-action / response
    // payloads coming back over the same channel — both can nest
    // WorkspaceEdit deep inside `edit.documentChanges[].textDocument.uri`,
    // `edit.changes`, `command.arguments`, etc.
    if (
      msg.method === 'workspace/applyEdit' ||
      msg.params !== undefined ||
      (msg as { result?: unknown }).result !== undefined
    ) {
      const rewritten = rewriteUrisDeep(msg, session, 'serverToClient') as LspMessage
      if (rewritten !== msg) msg = rewritten
    }

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
      contentByClientUri: new Map(),
      versionByClientUri: new Map(),
      languageIdByClientUri: new Map(),
      wrapOffsetByClientUri: new Map(),
      currentClientUri: null,
      serverDocVersion: 0,
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
        // Defense in depth: drop `publishDiagnostics` for any URI we
        // never explicitly opened on this session. csharp-ls is per-file
        // and OmniSharp is project-aware — both can surface diagnostics
        // for files the workspace builder placed in `/tmp/vnext-lsp/...`
        // (e.g. `GlobalUsings.cs`, `session.csproj`) or files in the
        // user's actual workspace if any path leaks through MSBuild
        // discovery. The bridge only owns Script.cs ↔ <client URI> for
        // the .csx the user is editing; anything outside that mapping
        // is not ours to publish.
        if (
          incoming.method === 'textDocument/publishDiagnostics' &&
          typeof incoming.params?.uri === 'string'
        ) {
          const normalized = normalizeFileUri(incoming.params.uri)
          if (!session.serverToClient.has(normalized)) {
            logger.warn(
              { sessionId, uri: incoming.params.uri },
              'publishDiagnostics dropped — URI not owned by this LSP session',
            )
            return
          }
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

    // ── Multi-file aware routing ──────────────────────────────────────
    // The server only ever owns a single `Script.cs`. We time-slice it
    // across all open `.csx` files: whichever client URI the user is
    // currently interacting with becomes the "active" document, and the
    // bridge replays didClose + didOpen on the server when active
    // switches. Helper below does that switch atomically.
    const serverScriptUri = scriptFileUri(session.workspace)

    function setActiveDocument(clientUri: string): void {
      if (session.currentClientUri === clientUri) return
      const content = session.contentByClientUri.get(clientUri)
      if (content === undefined) {
        // We haven't seen this URI's didOpen yet; nothing safe to swap to.
        // The caller will still rewrite URIs on the outgoing message, but
        // the server will get a request for content it doesn't know about.
        // First didOpen for this file will fix this up.
        return
      }
      // Tell the server the previous document closed (so it cleans up
      // its in-memory state for Script.cs before we re-open with the
      // new content). Skip when nothing was active yet.
      if (session.currentClientUri !== null) {
        session.lspServer.send({
          jsonrpc: '2.0',
          method: 'textDocument/didClose',
          params: { textDocument: { uri: serverScriptUri } },
        })
      }
      const languageId = session.languageIdByClientUri.get(clientUri) ?? 'csharp'
      const version = ++session.serverDocVersion
      session.lspServer.send({
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: { uri: serverScriptUri, languageId, version, text: content },
        },
      })
      workspaceManager.updateScriptContent(session.workspace, content).catch((err) =>
        logger.warn({ err, sessionId }, 'Failed to mirror active document on switch'),
      )
      session.clientToServer.set(clientUri, serverScriptUri)
      session.serverToClient.set(normalizeFileUri(serverScriptUri), clientUri)
      session.wrapOffset = session.wrapOffsetByClientUri.get(clientUri) ?? 0
      session.currentClientUri = clientUri
      logger.info({ sessionId, clientUri }, 'LSP active document switched')
    }

    if (msg.method === 'textDocument/didOpen' && msg.params?.textDocument?.uri) {
      const td = msg.params.textDocument as {
        uri: string
        text?: string
        version?: number
        languageId?: string
      }
      const clientUri = td.uri
      const text = td.text ?? ''

      // Cache everything we'll need to re-replay this file later when
      // the user clicks back to it.
      session.contentByClientUri.set(clientUri, text)
      if (typeof td.version === 'number') session.versionByClientUri.set(clientUri, td.version)
      if (typeof td.languageId === 'string') {
        session.languageIdByClientUri.set(clientUri, td.languageId)
      }
      session.wrapOffsetByClientUri.set(clientUri, getWrapOffset(text))

      if (session.currentClientUri === null) {
        // First file the user opened becomes the initial active document
        // on the server; forward this didOpen as-is (rewritten to
        // Script.cs).
        session.clientToServer.set(clientUri, serverScriptUri)
        session.serverToClient.set(normalizeFileUri(serverScriptUri), clientUri)
        session.wrapOffset = getWrapOffset(text)
        session.currentClientUri = clientUri
        workspaceManager.updateScriptContent(session.workspace, text).catch((err) =>
          logger.warn({ err, sessionId }, 'Failed to mirror opened document'),
        )
        msg = rewriteOutgoing(msg, session)
        session.lspServer.send(msg)
        logger.info({ sessionId, clientUri }, 'LSP initial active document registered')
        return
      }

      // Already have an active doc — don't forward this didOpen. The
      // server can only host one Script.cs at a time, and forwarding
      // multiple didOpens for the same URI is a protocol violation
      // that csharp-ls / OmniSharp react to with confused state. We
      // cached the content above; the swap happens lazily the first
      // time the user interacts with this file (didChange or any
      // textDocument/* request).
      logger.info(
        { sessionId, clientUri },
        'LSP didOpen cached — active document unchanged',
      )
      return
    }

    if (msg.method === 'textDocument/didChange' && msg.params?.textDocument?.uri) {
      const clientUri = msg.params.textDocument.uri as string
      const text = msg.params?.contentChanges?.[0]?.text
      if (text !== undefined) {
        session.contentByClientUri.set(clientUri, text)
        session.wrapOffsetByClientUri.set(clientUri, getWrapOffset(text))
      }

      // didChange for a non-active file means the user just started
      // editing it — swap active before forwarding so the server's
      // model jumps to the new file's full content first, then the
      // change is applied on top.
      if (clientUri !== session.currentClientUri) {
        setActiveDocument(clientUri)
        // After setActiveDocument the server already has the latest
        // text via the synthetic didOpen. The incremental contentChanges
        // in this message would now double-apply. Skip forwarding.
        return
      }

      if (text !== undefined) {
        session.wrapOffset = getWrapOffset(text)
        workspaceManager.updateScriptContent(session.workspace, text).catch((err) =>
          logger.warn({ err, sessionId }, 'Failed to mirror script content'),
        )
      }
      msg = rewriteOutgoing(msg, session)
      session.lspServer.send(msg)
      return
    }

    if (msg.method === 'textDocument/didClose' && msg.params?.textDocument?.uri) {
      const clientUri = msg.params.textDocument.uri as string
      session.contentByClientUri.delete(clientUri)
      session.versionByClientUri.delete(clientUri)
      session.languageIdByClientUri.delete(clientUri)
      session.wrapOffsetByClientUri.delete(clientUri)
      if (session.currentClientUri === clientUri) {
        msg = rewriteOutgoing(msg, session)
        session.lspServer.send(msg)
        session.clientToServer.delete(clientUri)
        session.serverToClient.delete(normalizeFileUri(serverScriptUri))
        session.currentClientUri = null
      }
      return
    }

    // For any other textDocument/* (codeAction, completion, hover,
    // codeAction/resolve, etc.) ensure the server's active document
    // matches the client URI being asked about. This is what fixes the
    // "QuickFix lands on a different file" bug — without this swap,
    // the server processed the request against whatever file's didOpen
    // happened to fire last.
    if (msg.method?.startsWith('textDocument/')) {
      const clientUri = msg.params?.textDocument?.uri
      if (clientUri && clientUri !== session.currentClientUri) {
        setActiveDocument(clientUri)
      }
      msg = rewriteOutgoing(msg, session)
    } else if (msg.method !== 'initialize') {
      // Non-`textDocument/*` client→server traffic may still carry
      // client URIs nested inside its params — `codeAction/resolve` is
      // the canonical case (the resolve request echoes back the
      // unresolved code action whose URIs we previously rewrote to
      // client form). Run the deep walk so csharp-ls / OmniSharp see
      // their own coordinates again. `initialize` is excluded because
      // we already authored that message above with explicit workspace
      // URIs that point at our temp dir.
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
