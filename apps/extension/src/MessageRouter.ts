import { platform } from 'node:os'
import * as vscode from 'vscode'
import { VnextForgeError, ERROR_CODES } from '@vnext-forge/app-contracts'
import type { ApiResponse } from '@vnext-forge/app-contracts'
import { ProjectService } from '@handlers/project/service'
import { WorkspaceService } from '@handlers/workspace/service'
import { validateService } from '@handlers/validate/service'
import { TemplateService } from '@handlers/template/service'
import { proxyToRuntime } from '@handlers/runtime-proxy/handler'
import { baseLogger } from '@ext/shared/logger'
import {
  WebviewLspManager,
  isLspWebviewMessage,
  type LspWebviewMessage,
} from './lsp/WebviewLspManager'

// ── Message protocol ──────────────────────────────────────────────────────────

/** Webview → Extension Host */
export interface WebviewRequest {
  requestId: string
  type: 'api'
  method: string
  params: unknown
}

/** Extension Host → Webview */
export interface WebviewResponse {
  requestId: string
  result: ApiResponse<unknown>
}

// ── Router ────────────────────────────────────────────────────────────────────

export class MessageRouter {
  private readonly projectService = new ProjectService()
  private readonly workspaceService = new WorkspaceService()
  private readonly templateService = new TemplateService()
  private readonly lspManager = new WebviewLspManager()

  /**
   * Attach this router to a webview panel. Returns a disposable so it can be
   * cleaned up when the panel is disposed.
   */
  attach(panel: vscode.WebviewPanel): vscode.Disposable {
    const messageDisposable = panel.webview.onDidReceiveMessage(async (raw: unknown) => {
      // ── API request ────────────────────────────────────────────────────────
      if (isWebviewRequest(raw)) {
        const { requestId, method, params } = raw
        baseLogger.debug({ method, requestId }, 'webview request received')
        const result = await this.dispatch(method, params, requestId)
        const response: WebviewResponse = { requestId, result }
        panel.webview.postMessage(response)
        return
      }

      // ── LSP tunnel ─────────────────────────────────────────────────────────
      if (isLspWebviewMessage(raw)) {
        this.routeLsp(panel, raw)
        return
      }
    })

    // Tear down all LSP sessions when the panel closes.
    const disposeDisposable = panel.onDidDispose(() => {
      this.lspManager.disposeAll()
    })

    return vscode.Disposable.from(messageDisposable, disposeDisposable)
  }

  private routeLsp(panel: vscode.WebviewPanel, msg: LspWebviewMessage): void {
    const { event, sessionId } = msg
    switch (event) {
      case 'connect':
        this.lspManager.onConnect(panel, sessionId)
        break
      case 'message':
        this.lspManager.onMessage(sessionId, (msg as any).data as string)
        break
      case 'disconnect':
        this.lspManager.onDisconnect(sessionId)
        break
    }
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────

  private async dispatch(
    method: string,
    params: unknown,
    traceId: string,
  ): Promise<ApiResponse<unknown>> {
    try {
      const data = await this.handle(method, params, traceId)
      return { success: true, data, error: null }
    } catch (error) {
      const forge = toVnextForgeError(error, method, traceId)
      baseLogger.error(forge.toLogEntry(), 'handler error')
      const userMessage = forge.toUserMessage()
      return {
        success: false,
        data: null,
        error: {
          code: userMessage.code,
          message: userMessage.message,
          traceId: forge.traceId ?? traceId,
        },
      }
    }
  }

  private async handle(method: string, params: unknown, traceId: string): Promise<unknown> {
    const p = params as Record<string, unknown>

    switch (method) {
      // ── Projects ────────────────────────────────────────────────────────────
      case 'projects.list':
        return this.projectService.listProjects(traceId)

      case 'projects.getById':
        return this.projectService.getProject(str(p, 'id'), traceId)

      case 'projects.create':
        return this.projectService.createProject(
          str(p, 'domain'),
          optStr(p, 'description'),
          optStr(p, 'targetPath'),
          traceId,
        )

      case 'projects.import':
        return this.projectService.importProject(str(p, 'path'), traceId)

      case 'projects.getTree':
        return this.projectService.getFileTree(str(p, 'id'), traceId)

      case 'projects.getConfig':
        return this.projectService.getConfig(str(p, 'id'), traceId)

      case 'projects.getConfigStatus':
        return this.projectService.getConfigStatus(str(p, 'id'), traceId)

      case 'projects.writeConfig':
        return this.projectService.writeProjectConfig(str(p, 'id'), p.config as never, traceId)

      case 'projects.export':
        return this.projectService.exportProject(str(p, 'id'), str(p, 'targetPath'), traceId)

      case 'projects.remove':
        return this.projectService.removeProject(str(p, 'id'), traceId)

      case 'projects.getVnextComponentLayoutStatus':
        return this.projectService.getVnextComponentLayoutStatus(str(p, 'id'), traceId)

      case 'projects.seedVnextComponentLayout':
        return this.projectService.seedVnextComponentLayoutFromConfig(str(p, 'id'), traceId)

      case 'projects.getValidateScriptStatus':
        return this.projectService.getValidateScriptStatus(str(p, 'id'), traceId)

      case 'projects.getComponentFileTypes':
        return this.projectService.getComponentFileTypes(str(p, 'id'), traceId)

      // ── Files (workspace) ───────────────────────────────────────────────────
      case 'files.read':
        return { content: await this.workspaceService.readFile(str(p, 'path'), traceId) }

      case 'files.write':
        await this.workspaceService.writeFile(str(p, 'path'), str(p, 'content'), traceId)
        return null

      case 'files.delete':
        await this.workspaceService.deleteFile(str(p, 'path'), traceId)
        return null

      case 'files.mkdir':
        await this.workspaceService.createDirectory(str(p, 'path'), traceId)
        return null

      case 'files.rename':
        await this.workspaceService.renameFile(str(p, 'oldPath'), str(p, 'newPath'), traceId)
        return null

      case 'files.browse': {
        const SYSTEM_ROOT_TOKEN = '::system-root::'
        const reqPath = optStr(p, 'path')
        const entries = await this.workspaceService.browseDirs(reqPath, traceId)
        const folders = entries.filter((e) => e.type === 'directory')
        const responsePath =
          reqPath === SYSTEM_ROOT_TOKEN
            ? platform() === 'win32' ? '' : '/'
            : (reqPath ?? '')
        return { path: responsePath, folders }
      }

      case 'files.search':
        return this.workspaceService.searchFiles(
          str(p, 'project'),
          str(p, 'q'),
          {
            matchCase: p.matchCase as boolean | undefined,
            matchWholeWord: p.matchWholeWord as boolean | undefined,
            useRegex: p.useRegex as boolean | undefined,
            include: optStr(p, 'include'),
            exclude: optStr(p, 'exclude'),
          },
          traceId,
        )

      // ── Validation ──────────────────────────────────────────────────────────
      case 'validate.workflow':
        return validateService.validate(p.content)

      case 'validate.component':
        return validateService.validateComponent(p.content, str(p, 'type'))

      case 'validate.getAvailableTypes':
        return validateService.getAvailableTypes()

      case 'validate.getAllSchemas':
        return validateService.getAllSchemas()

      case 'validate.getSchema':
        return validateService.getSchema(str(p, 'type'))

      // ── Health ──────────────────────────────────────────────────────────────
      // Extension host is always "alive" — return a static healthy response so
      // the workflowExecution health check passes without an HTTP round-trip.
      case 'health.check':
        return { status: 'ok' }

      // ── Templates ───────────────────────────────────────────────────────────
      case 'templates.list':
        return this.templateService.checkValidateScript(str(p, 'projectPath'))

      // ── Runtime proxy ───────────────────────────────────────────────────────
      case 'runtime.proxy':
        return proxyToRuntime({
          method: str(p, 'method'),
          runtimePath: str(p, 'runtimePath'),
          query: p.query as Record<string, string> | undefined,
          body: optStr(p, 'body'),
          runtimeUrl: optStr(p, 'runtimeUrl'),
          traceId,
        })

      default:
        throw new VnextForgeError(
          ERROR_CODES.API_NOT_FOUND,
          `Unknown method: ${method}`,
          { source: 'MessageRouter.handle', layer: 'presentation', details: { method } },
          traceId,
        )
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWebviewRequest(value: unknown): value is WebviewRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'requestId' in value &&
    'type' in value &&
    (value as WebviewRequest).type === 'api' &&
    'method' in value
  )
}

function str(params: Record<string, unknown>, key: string): string {
  const val = params[key]
  if (typeof val !== 'string') {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      `Missing required parameter: ${key}`,
      { source: 'MessageRouter.str', layer: 'presentation', details: { key, actual: typeof val } },
    )
  }
  return val
}

function optStr(params: Record<string, unknown>, key: string): string | undefined {
  const val = params[key]
  return typeof val === 'string' ? val : undefined
}

function toVnextForgeError(error: unknown, method: string, traceId: string): VnextForgeError {
  if (error instanceof VnextForgeError) return error
  return new VnextForgeError(
    ERROR_CODES.INTERNAL_UNEXPECTED,
    error instanceof Error ? error.message : 'Unexpected error',
    { source: `MessageRouter.dispatch[${method}]`, layer: 'presentation' },
    traceId,
  )
}
