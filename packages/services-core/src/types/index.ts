// ─────────────────────────────────────────────────────────────────────────────
// Type-only entrypoint for `@vnext-forge-studio/services-core/types`.
//
// This file MUST NOT export anything that pulls in Node.js-only modules
// (file system, child_process, Ajv, ...). It is consumed by the browser
// bundle of `@vnext-forge-studio/designer-ui` so the React layer can speak the same
// vocabulary as the backend services without dragging in implementation code.
// ─────────────────────────────────────────────────────────────────────────────

export type {
  FileStat,
  DirectoryEntryStat,
  FileSystemAdapter,
  LoggerAdapter,
  LogPayload,
  ProcessAdapter,
  NetworkAdapter,
  NetworkRequestInit,
  NetworkResponse,
  WorkspaceRootResolver,
} from '../adapters/index.js'

export type {
  DirectoryEntry,
  FileSearchHit,
  FileSearchResponse,
  FileTreeNode,
  SearchResult,
  VnextWorkspaceConfig,
  VnextWorkspacePaths,
  WorkspaceAnalysisResult,
  WorkspaceConfigReadStatus,
  WorkspaceStructure,
} from '../services/workspace/types.js'

export type {
  ComponentFileTypeMap,
  LinkFile,
  ProjectConfigStatus,
  ProjectEntry,
  SeedVnextComponentLayoutResult,
  VnextComponentLayoutStatusResult,
} from '../services/project/types.js'

export type { FileRoute, FileRouteType } from '../services/file-router/file-router.service.js'

export type {
  ComponentValidationError,
  ComponentValidationResult,
} from '../services/validate/validate.service.js'

export type { MethodId } from '../registry/method-registry.js'
