import * as path from 'node:path';

import * as vscode from 'vscode';

import type { VnextWorkspaceRoot } from '../workspace-detector.js';

/**
 * Pick one detected vNext root. A single root is returned without a prompt;
 * several roots open a QuickPick. `undefined` when there is no root or the
 * user dismissed the picker.
 */
export async function pickWorkspaceRoot(
  roots: readonly VnextWorkspaceRoot[],
  opts: { title: string; placeHolder: string },
): Promise<VnextWorkspaceRoot | undefined> {
  if (roots.length === 0) return undefined;
  if (roots.length === 1) return roots[0];
  const picked = await vscode.window.showQuickPick(
    roots.map((root) => ({
      label: path.basename(root.folderPath),
      description: root.folderPath,
      root,
    })),
    { title: opts.title, placeHolder: opts.placeHolder, ignoreFocusOut: true },
  );
  return picked?.root;
}
