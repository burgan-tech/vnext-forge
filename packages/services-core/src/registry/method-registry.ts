import { ERROR_CODES, VnextForgeError } from '@vnext-forge/app-contracts'
import { z, type ZodTypeAny } from 'zod'

import type { ProjectService } from '../services/project/index.js'
import {
  projectsCreateParams,
  projectsCreateResult,
  projectsExportParams,
  projectsExportResult,
  projectsGetByIdParams,
  projectsGetByIdResult,
  projectsGetComponentFileTypesParams,
  projectsGetComponentFileTypesResult,
  projectsGetConfigParams,
  projectsGetConfigResult,
  projectsGetConfigStatusParams,
  projectsGetConfigStatusResult,
  projectsGetTreeParams,
  projectsGetTreeResult,
  projectsGetValidateScriptStatusParams,
  projectsGetValidateScriptStatusResult,
  projectsGetVnextComponentLayoutStatusParams,
  projectsGetVnextComponentLayoutStatusResult,
  projectsGetWorkspaceBootstrapParams,
  projectsGetWorkspaceBootstrapResult,
  projectsImportParams,
  projectsImportResult,
  projectsListParams,
  projectsListResult,
  projectsRemoveParams,
  projectsRemoveResult,
  projectsSeedVnextComponentLayoutParams,
  projectsSeedVnextComponentLayoutResult,
  projectsWriteConfigParams,
  projectsWriteConfigResult,
} from '../services/project/project-schemas.js'
import type { RuntimeProxyService } from '../services/runtime-proxy/runtime-proxy.service.js'
import {
  runtimeProxyParams,
  runtimeProxyResult,
} from '../services/runtime-proxy/runtime-proxy.service.js'
import type { TemplateService } from '../services/template/index.js'
import {
  templatesValidateScriptParams,
  templatesValidateScriptResult,
} from '../services/template/template.service.js'
import type { ValidateService } from '../services/validate/validate.service.js'
import {
  validateComponentParams,
  validateGetAllSchemasParams,
  validateGetAllSchemasResult,
  validateGetAvailableTypesParams,
  validateGetAvailableTypesResult,
  validateGetSchemaParams,
  validateGetSchemaResult,
  validateWorkflowParams,
  validationResultShape,
} from '../services/validate/validate.service.js'
import type { WorkspaceService } from '../services/workspace/index.js'
import {
  filesBrowseParams,
  filesBrowseResult,
  filesDeleteParams,
  filesDeleteResult,
  filesMkdirParams,
  filesMkdirResult,
  filesReadParams,
  filesReadResult,
  filesRenameParams,
  filesRenameResult,
  filesSearchParams,
  filesSearchResult,
  filesWriteParams,
  filesWriteResult,
} from '../services/workspace/workspace.service.js'

export interface ServiceRegistry {
  workspaceService: WorkspaceService
  projectService: ProjectService
  templateService: TemplateService
  validateService: ValidateService
  runtimeProxyService: RuntimeProxyService
}

/**
 * MethodHandler abstracts a single RPC-like operation.
 *
 * - `paramsSchema` validates the incoming request payload (after JSON parsing).
 * - `resultSchema` (optional) is informational; transports may use it for
 *   contract assertions in dev or for type inference.
 * - `handler` is the actual implementation; it receives parsed params, the
 *   resolved service registry and an optional traceId.
 */
export interface MethodHandler<P extends ZodTypeAny, R extends ZodTypeAny> {
  paramsSchema: P
  resultSchema?: R
  // The dispatcher always passes the parsed result of `paramsSchema`, so the
  // handler can safely treat `params` with the inferred type. We declare it as
  // `any` here so the registry stays a homogeneous map without losing the
  // ergonomics of `defineMethod` at the call sites.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (params: any, services: ServiceRegistry, traceId?: string) => Promise<any> | any
}

// `MethodHandler<any, any>` keeps the registry literal usable at the call
// sites (where each entry has its own params/result types) while still
// allowing the dispatcher to treat the registry as a homogeneous map.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MethodRegistry = Record<string, MethodHandler<any, any>>

/** Helper to preserve the inferred zod types of each individual entry. */
export function defineMethod<P extends ZodTypeAny, R extends ZodTypeAny>(
  method: MethodHandler<P, R>,
): MethodHandler<P, R> {
  return method
}

/**
 * Build the canonical method registry shared by every shell.
 *
 * The keys here are the wire identifiers used by:
 *  - the VS Code extension `MessageRouter` (`message.method`),
 *  - the Hono REST surface in `apps/server` (`/api/v1/<methodId>`),
 *  - the React `ApiTransport` in `@vnext-forge/designer-ui`.
 *
 * Adding a new shared method is a one-line entry below; transports never need
 * to be touched.
 */
export function buildMethodRegistry(): MethodRegistry {
  return {
    // ── files / workspace ────────────────────────────────────────────────────
    'files/read': {
      paramsSchema: filesReadParams,
      resultSchema: filesReadResult,
      handler: async ({ path }, { workspaceService }, traceId) => ({
        content: await workspaceService.readFile(path, traceId),
      }),
    },
    'files/write': {
      paramsSchema: filesWriteParams,
      resultSchema: filesWriteResult,
      handler: async ({ path, content }, { workspaceService }, traceId) => {
        await workspaceService.writeFile(path, content, traceId)
        return null
      },
    },
    'files/delete': {
      paramsSchema: filesDeleteParams,
      resultSchema: filesDeleteResult,
      handler: async ({ path }, { workspaceService }, traceId) => {
        await workspaceService.deleteFile(path, traceId)
        return null
      },
    },
    'files/mkdir': {
      paramsSchema: filesMkdirParams,
      resultSchema: filesMkdirResult,
      handler: async ({ path }, { workspaceService }, traceId) => {
        await workspaceService.createDirectory(path, traceId)
        return null
      },
    },
    'files/rename': {
      paramsSchema: filesRenameParams,
      resultSchema: filesRenameResult,
      handler: async ({ oldPath, newPath }, { workspaceService }, traceId) => {
        await workspaceService.renameFile(oldPath, newPath, traceId)
        return null
      },
    },
    'files/browse': {
      paramsSchema: filesBrowseParams,
      resultSchema: filesBrowseResult,
      handler: async (params, { workspaceService }, traceId) => {
        const { resolvedPath, entries } = await workspaceService.browseDirs(params.path, traceId)
        return { path: resolvedPath, folders: entries }
      },
    },
    'files/search': {
      paramsSchema: filesSearchParams,
      resultSchema: filesSearchResult,
      handler: async (
        { project, q, matchCase, matchWholeWord, useRegex, include, exclude },
        { workspaceService },
        traceId,
      ) => {
        return workspaceService.searchFiles(
          project,
          q,
          { matchCase, matchWholeWord, useRegex, include, exclude },
          traceId,
        )
      },
    },

    // ── projects ─────────────────────────────────────────────────────────────
    'projects/list': {
      paramsSchema: projectsListParams,
      resultSchema: projectsListResult,
      handler: async (_p, { projectService }, traceId) => projectService.listProjects(traceId),
    },
    'projects/getById': {
      paramsSchema: projectsGetByIdParams,
      resultSchema: projectsGetByIdResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.getProject(id, traceId),
    },
    'projects/create': {
      paramsSchema: projectsCreateParams,
      resultSchema: projectsCreateResult,
      handler: async ({ domain, description, targetPath }, { projectService }, traceId) =>
        projectService.createProject(domain, description, targetPath, traceId),
    },
    'projects/import': {
      paramsSchema: projectsImportParams,
      resultSchema: projectsImportResult,
      handler: async ({ path }, { projectService }, traceId) =>
        projectService.importProject(path, traceId),
    },
    'projects/remove': {
      paramsSchema: projectsRemoveParams,
      resultSchema: projectsRemoveResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.removeProject(id, traceId),
    },
    'projects/export': {
      paramsSchema: projectsExportParams,
      resultSchema: projectsExportResult,
      handler: async ({ id, targetPath }, { projectService }, traceId) =>
        projectService.exportProject(id, targetPath, traceId),
    },
    'projects/getTree': {
      paramsSchema: projectsGetTreeParams,
      resultSchema: projectsGetTreeResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.getFileTree(id, traceId),
    },
    'projects/getConfig': {
      paramsSchema: projectsGetConfigParams,
      resultSchema: projectsGetConfigResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.getConfig(id, traceId),
    },
    'projects/getConfigStatus': {
      paramsSchema: projectsGetConfigStatusParams,
      resultSchema: projectsGetConfigStatusResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.getConfigStatus(id, traceId),
    },
    'projects/writeConfig': {
      paramsSchema: projectsWriteConfigParams,
      resultSchema: projectsWriteConfigResult,
      handler: async ({ id, config }, { projectService }, traceId) =>
        projectService.writeProjectConfig(id, config, traceId),
    },
    'projects/getVnextComponentLayoutStatus': {
      paramsSchema: projectsGetVnextComponentLayoutStatusParams,
      resultSchema: projectsGetVnextComponentLayoutStatusResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.getVnextComponentLayoutStatus(id, traceId),
    },
    'projects/seedVnextComponentLayout': {
      paramsSchema: projectsSeedVnextComponentLayoutParams,
      resultSchema: projectsSeedVnextComponentLayoutResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.seedVnextComponentLayoutFromConfig(id, traceId),
    },
    'projects/getValidateScriptStatus': {
      paramsSchema: projectsGetValidateScriptStatusParams,
      resultSchema: projectsGetValidateScriptStatusResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.getValidateScriptStatus(id, traceId),
    },
    'projects/getComponentFileTypes': {
      paramsSchema: projectsGetComponentFileTypesParams,
      resultSchema: projectsGetComponentFileTypesResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.getComponentFileTypes(id, traceId),
    },
    'projects/getWorkspaceBootstrap': {
      paramsSchema: projectsGetWorkspaceBootstrapParams,
      resultSchema: projectsGetWorkspaceBootstrapResult,
      handler: async ({ id }, { projectService }, traceId) =>
        projectService.getWorkspaceBootstrap(id, traceId),
    },

    // ── templates ────────────────────────────────────────────────────────────
    'templates/validateScriptStatus': {
      paramsSchema: templatesValidateScriptParams,
      resultSchema: templatesValidateScriptResult,
      handler: async ({ projectPath }, { templateService }) =>
        templateService.checkValidateScript(projectPath),
    },

    // ── validation ───────────────────────────────────────────────────────────
    'validate/workflow': {
      paramsSchema: validateWorkflowParams,
      resultSchema: validationResultShape,
      handler: async ({ content }, { validateService }) => validateService.validate(content),
    },
    'validate/component': {
      paramsSchema: validateComponentParams,
      resultSchema: validationResultShape,
      handler: async ({ content, type }, { validateService }) =>
        validateService.validateComponent(content, type),
    },
    'validate/getAvailableTypes': {
      paramsSchema: validateGetAvailableTypesParams,
      resultSchema: validateGetAvailableTypesResult,
      handler: async (_p, { validateService }) => validateService.getAvailableTypes(),
    },
    'validate/getAllSchemas': {
      paramsSchema: validateGetAllSchemasParams,
      resultSchema: validateGetAllSchemasResult,
      handler: async (_p, { validateService }) => validateService.getAllSchemas(),
    },
    'validate/getSchema': {
      paramsSchema: validateGetSchemaParams,
      resultSchema: validateGetSchemaResult,
      handler: async ({ type }, { validateService }) => validateService.getSchema(type),
    },

    // ── runtime proxy ────────────────────────────────────────────────────────
    'runtime/proxy': {
      paramsSchema: runtimeProxyParams,
      resultSchema: runtimeProxyResult,
      handler: async (params, { runtimeProxyService }, traceId) =>
        runtimeProxyService.proxy(params, traceId),
    },

    // ── health ───────────────────────────────────────────────────────────────
    // Lightweight wrapper around the runtime engine's `/health` endpoint.
    //
    // The runtime engine being down is an EXPECTED operational state for the
    // designer, not an error: the UI just shows a "disconnected" indicator. So
    // we swallow `RUNTIME_CONNECTION_FAILED` here and report it as
    // `status: 'down'` over the success channel. That keeps the server logs
    // quiet (no ERROR / 502) and lets the UI render its disconnected state
    // without surfacing a warning per poll.
    'health/check': {
      paramsSchema: z.object({}).optional(),
      resultSchema: z.object({
        status: z.enum(['ok', 'down']),
      }),
      handler: async (_p, { runtimeProxyService }, traceId) => {
        try {
          const proxied = await runtimeProxyService.proxy(
            { method: 'GET', runtimePath: '/health' },
            traceId,
          )
          return {
            status: (proxied.status >= 200 && proxied.status < 300 ? 'ok' : 'down') as
              | 'ok'
              | 'down',
          }
        } catch (error) {
          if (
            error instanceof VnextForgeError &&
            error.code === ERROR_CODES.RUNTIME_CONNECTION_FAILED
          ) {
            return { status: 'down' as const }
          }
          throw error
        }
      },
    },
  }
}

export type MethodId = keyof ReturnType<typeof buildMethodRegistry>
