export {
  createWorkspaceService,
  filesReadParams,
  filesReadResult,
  filesWriteParams,
  filesWriteResult,
  filesDeleteParams,
  filesDeleteResult,
  filesMkdirParams,
  filesMkdirResult,
  filesRenameParams,
  filesRenameResult,
  filesBrowseParams,
  filesBrowseResult,
  filesSearchParams,
  filesSearchResult,
} from './workspace.service.js'
export type {
  WorkspaceService,
  WorkspaceServiceDeps,
} from './workspace.service.js'
export { createWorkspaceAnalyzer } from './workspace-analyzer.js'
export type { WorkspaceAnalyzer } from './workspace-analyzer.js'
export { CONFIG_FILE, COMPONENT_DIRS } from './constants.js'
export {
  workspaceRootConfigSchema,
  normalizeWorkspaceRootToConfig,
} from './workspace-config-schema.js'
export type {
  DirectoryEntry,
  FileSearchHit,
  FileSearchResponse,
  FileTreeNode,
  SearchResult,
  VnextWorkspaceConfig,
  VnextWorkspaceDependencies,
  VnextWorkspaceExports,
  VnextWorkspaceExportsMeta,
  VnextWorkspacePaths,
  VnextWorkspaceReferenceResolution,
  WorkspaceAnalysisResult,
  WorkspaceConfigReadStatus,
  WorkspaceStructure,
} from './types.js'
