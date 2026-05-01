import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import type { VnextWorkspaceDetector } from '../../workspace-detector.js';
import { baseLogger } from '../../shared/logger.js';
import type { ForgeTerminalManager } from '../forge-terminal.js';

type CreateProjectNodeId = 'createProject';

export class CreateProjectProvider implements vscode.TreeDataProvider<CreateProjectNodeId> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<CreateProjectNodeId | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly detector: VnextWorkspaceDetector,
    private readonly terminal: ForgeTerminalManager,
  ) {}

  getTreeItem(_element: CreateProjectNodeId): vscode.TreeItem {
    const item = new vscode.TreeItem('Create vNext Project', vscode.TreeItemCollapsibleState.None);
    item.description = 'npx @burgan-tech/vnext-template';
    item.iconPath = new vscode.ThemeIcon('add');
    item.command = {
      command: 'vnextForge.tools.createProjectFromSidebar',
      title: 'Create vNext Project',
    };
    return item;
  }

  getChildren(element?: CreateProjectNodeId): CreateProjectNodeId[] {
    if (element) return [];
    return ['createProject'];
  }

  async createProject(): Promise<void> {
    const domainName = await vscode.window.showInputBox({
      title: 'Create vNext Project',
      prompt: 'Domain name (e.g. user-management)',
      placeHolder: 'my-domain',
      validateInput: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return 'Domain name is required';
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
          return 'Use letters, digits, ".", "_" or "-" (must start with a letter or digit)';
        }
        return null;
      },
      ignoreFocusOut: true,
    });
    if (!domainName) return;

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) {
      void vscode.window.showWarningMessage('vnext-forge: Open a folder first.');
      return;
    }

    const isInstalled = await this.checkTemplateInstalled();
    const command = isInstalled
      ? `npx @burgan-tech/vnext-template ${domainName.trim()}`
      : `npm install -g @burgan-tech/vnext-template && npx @burgan-tech/vnext-template ${domainName.trim()}`;

    this.terminal.run(command, { cwd });

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(cwd, '**/vnext.config.json'),
    );
    const disposable = watcher.onDidCreate(() => {
      void this.detector.refresh();
      disposable.dispose();
      watcher.dispose();
    });
    setTimeout(() => {
      disposable.dispose();
      watcher.dispose();
    }, 120_000);
  }

  private checkTemplateInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile('npx', ['@burgan-tech/vnext-template', '--version'], {
        timeout: 10_000,
        shell: process.platform === 'win32',
      }, (error) => {
        if (error) {
          baseLogger.info({}, 'vnext-template not found globally, will install');
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
}
