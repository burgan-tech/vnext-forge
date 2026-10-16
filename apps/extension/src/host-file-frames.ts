import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import * as vscode from 'vscode';

import type { LoggerAdapter } from '@vnext-forge-studio/services-core';

import { safeFileName, type HostBytesFrame } from './host-file-frame-guards.js';

export { isHostBytesFrame, type HostBytesFrame } from './host-file-frame-guards.js';

function saveFilters(fileName: string): Record<string, string[]> {
  const ext = path.extname(fileName).slice(1);
  return ext ? { [ext.toUpperCase()]: [ext], 'All Files': ['*'] } : { 'All Files': ['*'] };
}

export async function handleHostBytesFrame(frame: HostBytesFrame, logger: LoggerAdapter): Promise<void> {
  const name = safeFileName(frame.fileName);
  const bytes = Buffer.from(frame.contentBase64, 'base64');

  if (frame.type === 'host:save-bytes') {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(workspaceRoot ? path.join(workspaceRoot, name) : name),
      filters: saveFilters(name),
    });
    if (!target) return;
    try {
      await vscode.workspace.fs.writeFile(target, bytes);
      void vscode.window.showInformationMessage(`Saved ${path.basename(target.fsPath)}`);
    } catch (error) {
      logger.error({ err: error, path: target.fsPath } as Record<string, unknown>, 'host:save-bytes write failed');
      void vscode.window.showErrorMessage(`Could not save ${path.basename(target.fsPath)}`);
    }
    return;
  }

  // Open: a private temporary copy, shown by VS Code (images and text preview;
  // other types get VS Code's own "open with" handling).
  const dir = path.join(os.tmpdir(), 'vnext-forge-files', randomUUID());
  const file = path.join(dir, name);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(file, bytes, { mode: 0o600 });
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file));
  } catch (error) {
    logger.error({ err: error, path: file } as Record<string, unknown>, 'host:open-bytes failed');
    void vscode.window.showErrorMessage(`Could not open ${name}`);
  }
}
