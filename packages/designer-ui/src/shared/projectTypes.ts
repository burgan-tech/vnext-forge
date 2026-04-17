/**
 * Shared project/workspace types consumed by BOTH editor views (shared
 * designer UI) and the web shell (project list, file tree, wizards).
 *
 * `VnextWorkspaceConfig` is re-exported from `@vnext-forge/app-contracts` so
 * every consumer has a single import source regardless of whether it lives in
 * a shared editor, the web shell, or the VS Code extension webview.
 */
import type { VnextWorkspaceConfig } from '@vnext-forge/app-contracts';

export type { VnextWorkspaceConfig } from '@vnext-forge/app-contracts';

export interface ProjectInfo {
  id: string;
  domain: string;
  description?: string;
  path: string;
  version?: string;
  linked?: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export type ProjectConfigStatus =
  | { status: 'ok'; config: VnextWorkspaceConfig }
  | { status: 'missing' }
  | { status: 'invalid'; message: string };

export type WriteProjectConfigPayload = VnextWorkspaceConfig;

export interface SeedVnextComponentLayoutResult {
  ensuredPaths: string[];
}

export interface VnextComponentLayoutStatus {
  projectContainsOnlyConfigFile: boolean;
  componentsRootPresent: boolean;
  missingLayoutPaths: string[];
  layoutComplete: boolean;
}
