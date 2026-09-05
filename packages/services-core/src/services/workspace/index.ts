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
export { createWorkspaceAnalyzer, parseConfigStatus } from './workspace-analyzer.js'
export type { ReadConfigOptions, WorkspaceAnalyzer } from './workspace-analyzer.js'
export {
  listSolutionFiles,
  missingDomainIssue,
  pickDefaultSolution,
  readSolutionFile,
  resolvePackageJsonPath,
  resolveSolutionForComponent,
  resolveSolutionForPath,
  scanSolutionRoot,
  validateSolutionSet,
  PACKAGE_JSON_FILE_NAME,
} from './solution-files.js'
export type {
  ResolvedComponentSolution,
  SolutionIssue,
  SolutionIssueCode,
  SolutionIssueSeverity,
  SolutionScanResult,
  VnextSolutionFile,
} from './solution-files.js'
export {
  applySchemaVersionToPackageJson,
  computePackageJsonUpdate,
  schemaVersionRange,
  VNEXT_SCHEMA_PACKAGE,
} from './schema-version-sync.js'
export type { PackageJsonDependencySection, PackageJsonUpdate } from './schema-version-sync.js'
export {
  DEFAULT_SOLUTION_FILE_NAME,
  domainFromSolutionFileName,
  isDefaultSolutionFileName,
  isSolutionFileName,
  solutionDisplayLabel,
  solutionFileNameForDomain,
} from '@vnext-forge-studio/vnext-types'
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
