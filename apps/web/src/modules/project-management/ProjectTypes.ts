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
