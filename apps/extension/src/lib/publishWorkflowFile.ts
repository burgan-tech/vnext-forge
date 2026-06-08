import * as path from 'node:path';

import * as vscode from 'vscode';

import type { ForgeTerminalManager } from '../tools/forge-terminal.js';

export interface PublishWorkflowFileParams {
  /** Absolute on-disk path of the workflow JSON file to publish. */
  filePath: string;
  /** Shared terminal manager (reuses the persistent Forge terminal). */
  terminal: ForgeTerminalManager;
  /** Optional logger — receives diagnostic warnings (workspace miss, etc.). */
  logger?: { warn(data: Record<string, unknown>, message?: string): void };
}

export interface PublishWorkflowFileResult {
  ok: boolean;
  /** Human-readable reason when `ok=false` (returned to the caller for
   *  user-facing error notifications). */
  reason?: string;
}

/**
 * Single entry-point for publishing a workflow JSON to the runtime via
 * `wf update -f <path>`. Called from two surfaces:
 *
 *   1. The webview-side Publish button (`MessageRouter.handlePublishFrame`),
 *      which delivers the file path through the postMessage envelope.
 *   2. The Explorer right-click "Forge: Publish" command, which delivers
 *      the file path through the VS Code menu invocation.
 *
 * Validation contract (kept identical to the legacy `handlePublishFrame`
 * implementation):
 *   - The path must be non-empty.
 *   - When a workspace is open, the path must resolve **inside** the
 *     first workspace folder (jail check — guards against an attacker
 *     posting an absolute path that escapes the workspace tree).
 *   - Paths containing spaces are quoted so the terminal accepts them
 *     verbatim.
 *
 * On success: queues the command on the shared Forge terminal and
 * returns immediately. The terminal output is the user-visible feedback.
 */
export function publishWorkflowFile(params: PublishWorkflowFileParams): PublishWorkflowFileResult {
  const { terminal, logger } = params;
  const rawPath = params.filePath?.trim();
  if (!rawPath) {
    return { ok: false, reason: 'No file path provided.' };
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    const normalized = path.normalize(rawPath);
    const rel = path.relative(workspaceRoot, normalized);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      logger?.warn(
        { path: normalized } as Record<string, unknown>,
        'publishWorkflowFile rejected: path outside workspace',
      );
      return { ok: false, reason: 'Path is outside the active workspace.' };
    }
  }

  const escapedPath = rawPath.includes(' ') ? `"${rawPath}"` : rawPath;
  terminal.run(`wf update -f ${escapedPath}`, { cwd: workspaceRoot });
  return { ok: true };
}
