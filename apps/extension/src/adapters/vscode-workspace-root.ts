import { homedir } from 'node:os';
import path from 'node:path';

import * as vscode from 'vscode';

import type { WorkspaceRootResolver } from '@vnext-forge-studio/services-core';

/**
 * VS Code `WorkspaceRootResolver`.
 *
 * Prefers the first open workspace folder (the project IS the open workspace
 * inside VS Code). Falls back to `~/vnext-projects` when no workspace is
 * attached so the extension can still be activated from the command palette
 * with no folder open.
 */
export function createVsCodeWorkspaceRootResolver(): WorkspaceRootResolver {
  return {
    async resolveProjectsRoot(): Promise<string> {
      const first = vscode.workspace.workspaceFolders?.[0];
      if (first) {
        return first.uri.fsPath;
      }
      return path.join(homedir(), 'vnext-projects');
    },
  };
}
