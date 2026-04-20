/**
 * Web module-local re-export for backwards-compat. The canonical source for
 * these types is `@vnext-forge/designer-ui` (see `shared/projectTypes`).
 */
export type {
  FileTreeNode,
  ProjectConfigStatus,
  ProjectInfo,
  SeedVnextComponentLayoutResult,
  VnextComponentLayoutStatus,
  VnextWorkspaceConfig,
  WriteProjectConfigPayload,
} from '@vnext-forge/designer-ui';

/**
 * Folder entry returned by `files.browse`. Used by the web project
 * import / create dialogs to render the workspace browser. The extension
 * shell relies on the VS Code "Open Folder" UI instead, so this type lives
 * with the web module.
 */
export interface WorkspaceFolder {
  name: string;
  path: string;
}
