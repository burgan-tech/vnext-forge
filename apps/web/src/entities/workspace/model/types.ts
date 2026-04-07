export interface WorkspaceFolder {
  name: string;
  path: string;
}

export interface WorkspaceBrowseResult {
  path: string;
  folders: WorkspaceFolder[];
}
