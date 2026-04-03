import type { WorkspaceConfig } from '@interfaces/workspace.js'
import type { FileTreeNode } from '@interfaces/workspace-tree.js'

export interface WorkspaceAnalysisResult {
  rootPath: string
  config: WorkspaceConfig | null
  configValid: boolean
  tree: FileTreeNode
}
