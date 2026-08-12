import * as path from 'node:path';

/** A validated `quickrun:open-subflow-run` request. */
export interface OpenSubFlowRunRequest {
  /** Absolute, workspace-contained path of the sub-flow's workflow JSON. */
  workflowFilePath: string;
  domain: string;
  workflowKey: string;
}

/**
 * Validates the Quick Run webview's "open the sub-flow's runner" message.
 *
 * Kept free of `vscode` imports so it can be unit tested — the panel supplies
 * the workspace folder paths. The path is webview input, so it is only
 * accepted when it is a `.json` file inside one of those roots; a resolved
 * path is what the host later hands to `vnextForge.openQuickRunFromFile`.
 *
 * Returns `null` when the message is not ours or fails validation.
 */
export function parseOpenSubFlowRunMessage(
  raw: unknown,
  workspaceRoots: readonly string[],
): OpenSubFlowRunRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const msg = raw as Record<string, unknown>;
  if (msg.type !== 'quickrun:open-subflow-run') return null;

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;

  const rawPath = str(msg.workflowFilePath);
  const domain = str(msg.domain);
  const workflowKey = str(msg.workflowKey);
  if (!rawPath || !domain || !workflowKey) return null;
  if (!/\.json$/i.test(rawPath)) return null;

  let resolved: string;
  try {
    resolved = path.resolve(rawPath);
  } catch {
    return null;
  }

  if (!workspaceRoots.some((root) => isInside(root, resolved))) return null;

  return { workflowFilePath: resolved, domain, workflowKey };
}

function isInside(root: string, target: string): boolean {
  if (!root) return false;
  const caseInsensitive = process.platform === 'win32';
  const a = caseInsensitive ? path.resolve(root).toLowerCase() : path.resolve(root);
  const b = caseInsensitive ? target.toLowerCase() : target;
  const rel = path.relative(a, b);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
