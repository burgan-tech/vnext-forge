import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
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
  vnextCategoryListParams,
  vnextCategoryListResult,
  vnextComponentsListParams,
  vnextComponentsListResult,
} from '../services/project/project-schemas.js'
import {
  cliCheckParams,
  cliCheckResult,
  cliCheckUpdateParams,
  cliCheckUpdateResult,
  cliDomainAddParams,
  cliDomainAddResult,
  cliExecuteParams,
  cliExecuteResult,
  cliUpdateGlobalParams,
  cliUpdateGlobalResult,
} from '../services/cli/cli-schemas.js'
import type { CliService } from '../services/cli/cli.service.js'
import type { QuickRunService } from '../services/quickrun/quickrun.service.js'
import type { QuickswitcherService } from '../services/quickswitcher/quickswitcher.service.js'
import {
  quickswitcherBuildIndexParams,
  quickswitcherBuildIndexResult,
} from '../services/quickswitcher/quickswitcher-schemas.js'
import type { SessionsService } from '../services/sessions/sessions.service.js'
import {
  sessionsClearParams,
  sessionsClearResult,
  sessionsGetParams,
  sessionsGetResult,
  sessionsSaveParams,
  sessionsSaveResult,
} from '../services/sessions/sessions-schemas.js'
import type { SnippetsService } from '../services/snippets/snippets.service.js'
import {
  snippetsDeleteParams,
  snippetsDeleteResult,
  snippetsGetOneParams,
  snippetsGetOneResult,
  snippetsListAllParams,
  snippetsListAllResult,
  snippetsOpenLocationParams,
  snippetsOpenLocationResult,
  snippetsSaveParams,
  snippetsSaveResult,
} from '../services/snippets/snippets-schemas.js'
import type { TestDataService } from '../services/test-data/test-data.service.js'
import {
  testDataGenerateForSchemaComponentParamsSchema,
  testDataGenerateForSchemaComponentResultSchema,
  testDataGenerateForSchemaReferenceParamsSchema,
  testDataGenerateForSchemaReferenceResultSchema,
  testDataGenerateParamsSchema,
  testDataGenerateResultSchema,
} from '../services/test-data/test-data-schemas.js'
import type { QuickRunPresetsService } from '../services/quickrun-presets/quickrun-presets.service.js'
import {
  presetsDeleteParamsSchema,
  presetsDeleteResultSchema,
  presetsGetParamsSchema,
  presetsGetResultSchema,
  presetsListParamsSchema,
  presetsListResultSchema,
  presetsSaveParamsSchema,
  presetsSaveResultSchema,
} from '../services/quickrun-presets/quickrun-presets-schemas.js'
import {
  quickrunFireTransitionParams,
  quickrunFireTransitionResult,
  quickrunGetDataParams,
  quickrunGetDataResult,
  quickrunGetHistoryParams,
  quickrunGetHistoryResult,
  quickrunGetInstanceParams,
  quickrunGetInstanceResult,
  quickrunGetSchemaParams,
  quickrunGetSchemaResult,
  quickrunGetStateParams,
  quickrunGetStateResult,
  quickrunGetViewParams,
  quickrunGetViewResult,
  quickrunListInstancesParams,
  quickrunListInstancesResult,
  quickrunRetryInstanceParams,
  quickrunRetryInstanceResult,
  quickrunStartInstanceParams,
  quickrunStartInstanceResult,
} from '../services/quickrun/quickrun-schemas.js'
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
  quickRunService: QuickRunService
  /**
   * Used by `cli/*` methods. Optional so hosts that invoke `wf` only via other
   * means (for example an integrated terminal) can omit wiring.
   */
  cliService?: CliService
  quickswitcherService: QuickswitcherService
  sessionsService: SessionsService
  snippetsService: SnippetsService
  testDataService: TestDataService
  quickRunPresetsService: QuickRunPresetsService
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
 *  - the React `ApiTransport` in `@vnext-forge-studio/designer-ui`.
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
        {
          projectId,
          projectPath,
          query,
          caseSensitive,
          wholeWord,
          useRegex,
          includePatterns,
          excludePatterns,
          limit,
          cursor,
        },
        { workspaceService, projectService },
        traceId,
      ) => {
        const rootPath =
          projectId && projectId.length > 0
            ? (await projectService.getProject(projectId, traceId)).path
            : projectPath

        return workspaceService.searchFiles(
          rootPath,
          query,
          {
            caseSensitive,
            wholeWord,
            useRegex,
            includePatterns,
            excludePatterns,
            limit,
            cursor,
          },
          traceId,
        )
      },
    },
    'files/search/stream': {
      paramsSchema: filesSearchParams,
      resultSchema: filesSearchResult,
      handler: async (
        {
          projectId,
          projectPath,
          query,
          caseSensitive,
          wholeWord,
          useRegex,
          includePatterns,
          excludePatterns,
          limit,
          cursor,
        },
        { workspaceService, projectService },
        traceId,
      ) => {
        const rootPath =
          projectId && projectId.length > 0
            ? (await projectService.getProject(projectId, traceId)).path
            : projectPath

        return workspaceService.searchFiles(
          rootPath,
          query,
          {
            caseSensitive,
            wholeWord,
            useRegex,
            includePatterns,
            excludePatterns,
            limit,
            cursor,
          },
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

    // ── vNext component discovery (BFF) ────────────────────────────────────
    'vnext/components/list': {
      paramsSchema: vnextComponentsListParams,
      resultSchema: vnextComponentsListResult,
      handler: async ({ id, category, previewPaths }, { projectService }, traceId) =>
        projectService.listVnextComponents(
          id,
          { category, previewPaths },
          traceId,
        ),
    },
    'vnext/tasks/list': {
      paramsSchema: vnextCategoryListParams,
      resultSchema: vnextCategoryListResult,
      handler: async ({ id }, { projectService }, traceId) => {
        const { components } = await projectService.listVnextComponents(
          id,
          { category: 'tasks' },
          traceId,
        )
        return components.tasks
      },
    },
    'vnext/workflows/list': {
      paramsSchema: vnextCategoryListParams,
      resultSchema: vnextCategoryListResult,
      handler: async ({ id }, { projectService }, traceId) => {
        const { components } = await projectService.listVnextComponents(
          id,
          { category: 'workflows' },
          traceId,
        )
        return components.workflows
      },
    },
    'vnext/schemas/list': {
      paramsSchema: vnextCategoryListParams,
      resultSchema: vnextCategoryListResult,
      handler: async ({ id }, { projectService }, traceId) => {
        const { components } = await projectService.listVnextComponents(
          id,
          { category: 'schemas' },
          traceId,
        )
        return components.schemas
      },
    },
    'vnext/views/list': {
      paramsSchema: vnextCategoryListParams,
      resultSchema: vnextCategoryListResult,
      handler: async ({ id }, { projectService }, traceId) => {
        const { components } = await projectService.listVnextComponents(
          id,
          { category: 'views' },
          traceId,
        )
        return components.views
      },
    },
    'vnext/functions/list': {
      paramsSchema: vnextCategoryListParams,
      resultSchema: vnextCategoryListResult,
      handler: async ({ id }, { projectService }, traceId) => {
        const { components } = await projectService.listVnextComponents(
          id,
          { category: 'functions' },
          traceId,
        )
        return components.functions
      },
    },
    'vnext/extensions/list': {
      paramsSchema: vnextCategoryListParams,
      resultSchema: vnextCategoryListResult,
      handler: async ({ id }, { projectService }, traceId) => {
        const { components } = await projectService.listVnextComponents(
          id,
          { category: 'extensions' },
          traceId,
        )
        return components.extensions
      },
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
      // Workflow validation always uses the dedicated 'workflow' AJV
      // schema. When a `schemaVersion` arrives we route through the
      // version-aware path so validators come from the cached package
      // matching the project's vnext.config.
      handler: async ({ content, schemaVersion }, { validateService }) =>
        validateService.validateComponentVersioned(content, 'workflow', schemaVersion),
    },
    'validate/component': {
      paramsSchema: validateComponentParams,
      resultSchema: validationResultShape,
      handler: async ({ content, type, schemaVersion }, { validateService }) =>
        validateService.validateComponentVersioned(content, type, schemaVersion),
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
      // Routes through `getSchemaVersioned` so callers that pass the
      // project's `schemaVersion` see the exact `@burgan-tech/vnext-schema`
      // contract pinned in `vnext.config.json`. When the version is
      // omitted (or no schemaCacheService is wired) it transparently
      // falls back to the bundled module — same shape as before.
      handler: async ({ type, schemaVersion }, { validateService }) =>
        validateService.getSchemaVersioned(type, schemaVersion),
    },

    // ── runtime proxy ────────────────────────────────────────────────────────
    'runtime/proxy': {
      paramsSchema: runtimeProxyParams,
      resultSchema: runtimeProxyResult,
      handler: async (params, { runtimeProxyService }, traceId) =>
        runtimeProxyService.proxy(params, traceId),
    },

    // ── quickrun ─────────────────────────────────────────────────────────────
    'quickrun/startInstance': {
      paramsSchema: quickrunStartInstanceParams,
      resultSchema: quickrunStartInstanceResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.startInstance(params, traceId),
    },
    'quickrun/fireTransition': {
      paramsSchema: quickrunFireTransitionParams,
      resultSchema: quickrunFireTransitionResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.fireTransition(params, traceId),
    },
    'quickrun/getState': {
      paramsSchema: quickrunGetStateParams,
      resultSchema: quickrunGetStateResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getState(params, traceId),
    },
    'quickrun/getView': {
      paramsSchema: quickrunGetViewParams,
      resultSchema: quickrunGetViewResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getView(params, traceId),
    },
    'quickrun/getData': {
      paramsSchema: quickrunGetDataParams,
      resultSchema: quickrunGetDataResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getData(params, traceId),
    },
    'quickrun/getSchema': {
      paramsSchema: quickrunGetSchemaParams,
      resultSchema: quickrunGetSchemaResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getSchema(params, traceId),
    },
    'quickrun/getHistory': {
      paramsSchema: quickrunGetHistoryParams,
      resultSchema: quickrunGetHistoryResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getHistory(params, traceId),
    },
    'quickrun/retryInstance': {
      paramsSchema: quickrunRetryInstanceParams,
      resultSchema: quickrunRetryInstanceResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.retryInstance(params, traceId),
    },
    'quickrun/listInstances': {
      paramsSchema: quickrunListInstancesParams,
      resultSchema: quickrunListInstancesResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.listInstances(params, traceId),
    },
    'quickrun/getInstance': {
      paramsSchema: quickrunGetInstanceParams,
      resultSchema: quickrunGetInstanceResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getInstance(params, traceId),
    },

    // ── wf CLI ───────────────────────────────────────────────────────────────
    'cli/check': {
      paramsSchema: cliCheckParams,
      resultSchema: cliCheckResult,
      handler: async (_params, { cliService }) => {
        if (!cliService) {
          throw new VnextForgeError(
            ERROR_CODES.INTERNAL_NOT_IMPLEMENTED,
            'Workflow CLI is not available in this shell.',
            { source: 'method-registry.cli/check', layer: 'application' },
          )
        }
        return cliService.checkCliAvailable()
      },
    },
    'cli/execute': {
      paramsSchema: cliExecuteParams,
      resultSchema: cliExecuteResult,
      handler: async (params, { cliService, projectService }, traceId) => {
        if (!cliService) {
          throw new VnextForgeError(
            ERROR_CODES.INTERNAL_NOT_IMPLEMENTED,
            'Workflow CLI is not available in this shell.',
            { source: 'method-registry.cli/execute', layer: 'application' },
            traceId,
          )
        }
        const id = params.projectId?.trim() ?? ''
        const rootFromClient = params.projectPath?.trim() ?? ''
        const projectPath =
          id.length > 0 ? (await projectService.getProject(id, traceId)).path : rootFromClient

        return cliService.executeCommand(
          {
            command: params.command,
            projectPath,
            filePath: params.filePath,
            timeoutMs: params.timeoutMs,
          },
          traceId,
        )
      },
    },
    'cli/checkUpdate': {
      paramsSchema: cliCheckUpdateParams,
      resultSchema: cliCheckUpdateResult,
      handler: async (_params, { cliService }) => {
        if (!cliService) {
          throw new VnextForgeError(
            ERROR_CODES.INTERNAL_NOT_IMPLEMENTED,
            'Workflow CLI is not available in this shell.',
            { source: 'method-registry.cli/checkUpdate', layer: 'application' },
          )
        }
        return cliService.checkForUpdate()
      },
    },
    'cli/updateGlobal': {
      paramsSchema: cliUpdateGlobalParams,
      resultSchema: cliUpdateGlobalResult,
      handler: async (_params, { cliService }, traceId) => {
        if (!cliService) {
          throw new VnextForgeError(
            ERROR_CODES.INTERNAL_NOT_IMPLEMENTED,
            'Workflow CLI is not available in this shell.',
            { source: 'method-registry.cli/updateGlobal', layer: 'application' },
            traceId,
          )
        }
        return cliService.updateGlobal(traceId)
      },
    },
    'cli/domainAdd': {
      paramsSchema: cliDomainAddParams,
      resultSchema: cliDomainAddResult,
      handler: async (params, { cliService }, traceId) => {
        if (!cliService) {
          throw new VnextForgeError(
            ERROR_CODES.INTERNAL_NOT_IMPLEMENTED,
            'Workflow CLI is not available in this shell.',
            { source: 'method-registry.cli/domainAdd', layer: 'application' },
            traceId,
          )
        }
        return cliService.domainAdd(params, traceId)
      },
    },

    // ── quickswitcher ────────────────────────────────────────────────────────
    // Smart Search (Cmd+P) index builder. Walks a project's vnext component
    // folders + parses workflow JSONs for state/transition entries. Returns
    // the full flat list; client does fuzzy matching locally.
    'quickswitcher/buildIndex': {
      paramsSchema: quickswitcherBuildIndexParams,
      resultSchema: quickswitcherBuildIndexResult,
      handler: async (params, { quickswitcherService }, traceId) =>
        quickswitcherService.buildIndex(params, traceId),
    },

    // ── snippets ──────────────────────────────────────────────────────────────
    // File-based snippet library. Personal snippets live under
    // `~/.vnext-studio/snippets/`, project snippets under
    // `<project>/.vnextstudio/snippets/` (Git-tracked, team-shared).
    'snippets/listAll': {
      paramsSchema: snippetsListAllParams,
      resultSchema: snippetsListAllResult,
      handler: async (params, { snippetsService }, traceId) =>
        snippetsService.listAll(params, traceId),
    },
    'snippets/getOne': {
      paramsSchema: snippetsGetOneParams,
      resultSchema: snippetsGetOneResult,
      handler: async (params, { snippetsService }, traceId) =>
        snippetsService.getOne(params, traceId),
    },
    'snippets/save': {
      paramsSchema: snippetsSaveParams,
      resultSchema: snippetsSaveResult,
      handler: async (params, { snippetsService }, traceId) =>
        snippetsService.save(params, traceId),
    },
    'snippets/delete': {
      paramsSchema: snippetsDeleteParams,
      resultSchema: snippetsDeleteResult,
      handler: async (params, { snippetsService }, traceId) =>
        snippetsService.deleteOne(params, traceId),
    },
    'snippets/openLocation': {
      paramsSchema: snippetsOpenLocationParams,
      resultSchema: snippetsOpenLocationResult,
      handler: async (params, { snippetsService }, traceId) =>
        snippetsService.openLocation(params, traceId),
    },

    // ── sessions ──────────────────────────────────────────────────────────────
    // Per-project workspace session — open tabs, sidebar view, runtime
    // connection, palette queries. Persisted as `<project>/.vnextstudio/session.json`.
    'sessions/get': {
      paramsSchema: sessionsGetParams,
      resultSchema: sessionsGetResult,
      handler: async (params, { sessionsService }, traceId) =>
        sessionsService.get(params, traceId),
    },
    'sessions/save': {
      paramsSchema: sessionsSaveParams,
      resultSchema: sessionsSaveResult,
      handler: async (params, { sessionsService }, traceId) =>
        sessionsService.save(params, traceId),
    },
    'sessions/clear': {
      paramsSchema: sessionsClearParams,
      resultSchema: sessionsClearResult,
      handler: async (params, { sessionsService }, traceId) =>
        sessionsService.clear(params, traceId),
    },

    // ── test-data ─────────────────────────────────────────────────────────────
    // Schema-driven random JSON generator. Two entry points: generic (caller
    // supplies any JSON Schema) and component-aware (caller picks a project's
    // `Schemas/<group>/<name>.json` and we extract `attributes.schema`).
    'test-data/generate': {
      paramsSchema: testDataGenerateParamsSchema,
      resultSchema: testDataGenerateResultSchema,
      handler: async (params, { testDataService }) => testDataService.generate(params),
    },
    'test-data/generateForSchemaComponent': {
      paramsSchema: testDataGenerateForSchemaComponentParamsSchema,
      resultSchema: testDataGenerateForSchemaComponentResultSchema,
      handler: async (params, { testDataService }) =>
        testDataService.generateForSchemaComponent(params),
    },
    'test-data/generateForSchemaReference': {
      paramsSchema: testDataGenerateForSchemaReferenceParamsSchema,
      resultSchema: testDataGenerateForSchemaReferenceResultSchema,
      handler: async (params, { testDataService }) =>
        testDataService.generateForSchemaReference(params),
    },

    // ── quickrun-presets ────────────────────────────────────────────────
    // Named start-payload templates per workflow. Stored in
    // `<userData>/quickrun-presets/<projectId>/<workflowKey>/<slug>.json`.
    // Useful for "happy path", "blacklisted user", "missing subject" scenarios.
    'quickrun-presets/list': {
      paramsSchema: presetsListParamsSchema,
      resultSchema: presetsListResultSchema,
      handler: async (params, { quickRunPresetsService }) =>
        quickRunPresetsService.list(params),
    },
    'quickrun-presets/get': {
      paramsSchema: presetsGetParamsSchema,
      resultSchema: presetsGetResultSchema,
      handler: async (params, { quickRunPresetsService }) =>
        quickRunPresetsService.get(params),
    },
    'quickrun-presets/save': {
      paramsSchema: presetsSaveParamsSchema,
      resultSchema: presetsSaveResultSchema,
      handler: async (params, { quickRunPresetsService }) =>
        quickRunPresetsService.save(params),
    },
    'quickrun-presets/delete': {
      paramsSchema: presetsDeleteParamsSchema,
      resultSchema: presetsDeleteResultSchema,
      handler: async (params, { quickRunPresetsService }) =>
        quickRunPresetsService.delete(params),
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
      paramsSchema: z
        .object({
          runtimeUrl: z.string().optional(),
        })
        .optional(),
      resultSchema: z.object({
        status: z.enum(['ok', 'down']),
      }),
      handler: async (params, { runtimeProxyService }, traceId) => {
        const runtimeUrl =
          typeof params?.runtimeUrl === 'string' && params.runtimeUrl.length > 0
            ? params.runtimeUrl
            : undefined
        try {
          const proxied = await runtimeProxyService.proxy(
            {
              method: 'GET',
              runtimePath: '/health',
              ...(runtimeUrl ? { runtimeUrl } : {}),
            },
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
            (error.code === ERROR_CODES.RUNTIME_CONNECTION_FAILED ||
              error.code === ERROR_CODES.API_FORBIDDEN)
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
