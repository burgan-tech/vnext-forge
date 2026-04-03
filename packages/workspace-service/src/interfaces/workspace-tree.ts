export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface WorkspaceStructure {
  root: FileTreeNode
}
