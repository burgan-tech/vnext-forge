/**
 * Web module-local re-export for backwards-compat. The canonical source for
 * these types is `@vnext-forge-studio/designer-ui` (see `shared/projectTypes`).
 */
import type {
  FileTreeNode,
  ProjectConfigStatus,
  ProjectInfo,
  VnextComponentLayoutStatus,
} from '@vnext-forge-studio/designer-ui';

export type {
  FileTreeNode,
  ProjectConfigStatus,
  ProjectInfo,
  SeedVnextComponentLayoutResult,
  VnextComponentLayoutStatus,
  VnextWorkspaceConfig,
  WriteProjectConfigPayload,
} from '@vnext-forge-studio/designer-ui';

/**
 * Single round-trip payload for opening a project workspace. Mirrors the
 * server-side `projects/getWorkspaceBootstrap` aggregation: cheap fields are
 * always populated; the expensive fields (`layoutStatus`,
 * `validateScriptStatus`, `componentFileTypes`) are only computed when
 * `configStatus.status === 'ok'`. `componentFileTypes` may still be `null`
 * when the server skips bootstrap-time JSON `flow` scanning.
 */
export interface ProjectWorkspaceBootstrap {
  project: ProjectInfo;
  tree: { root: FileTreeNode };
  configStatus: ProjectConfigStatus;
  layoutStatus: VnextComponentLayoutStatus | null;
  validateScriptStatus: { exists: boolean } | null;
  componentFileTypes: Record<string, string> | null;
}

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
