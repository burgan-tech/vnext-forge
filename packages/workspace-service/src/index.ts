export type {
  IWorkspace,
  WorkspaceConfig,
  WorkspaceDependencies,
  WorkspaceExports,
  WorkspaceMetadata,
  WorkspacePaths,
  ReferenceResolutionConfig,
} from './interfaces/workspace.js'
export type { FileTreeNode, WorkspaceStructure } from './interfaces/workspace-tree.js'
export { CONFIG_FILE, COMPONENT_DIRS } from './paths/constants.js'
export { resolveComponentPath, resolveConfigPath } from './paths/resolver.js'
export type { WorkspaceAnalysisResult } from './analyzer/types.js'
export { WorkspaceAnalyzer } from './analyzer/workspace-analyzer.js'
