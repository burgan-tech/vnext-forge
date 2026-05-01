import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import type { VnextWorkspaceDetector } from '../../workspace-detector.js';
import { baseLogger } from '../../shared/logger.js';
import type { ForgeTerminalManager } from '../forge-terminal.js';

type DeployNodeId = 'wfUpdateAll' | 'wfUpdate' | 'wfCsxAll' | 'installWfCli';

interface DeployAction {
  id: DeployNodeId;
  label: string;
  description: string;
  icon: string;
  command: string;
}

const DEPLOY_ACTIONS: DeployAction[] = [
  {
    id: 'wfUpdateAll',
    label: 'Deploy All',
    description: 'wf update --all',
    icon: 'cloud-upload',
    command: 'vnextForge.tools.wfUpdateAll',
  },
  {
    id: 'wfUpdate',
    label: 'Deploy Changed',
    description: 'wf update (git diff)',
    icon: 'diff',
    command: 'vnextForge.tools.wfUpdate',
  },
  {
    id: 'wfCsxAll',
    label: 'CSX Update All',
    description: 'wf csx --all',
    icon: 'file-code',
    command: 'vnextForge.tools.wfCsxAll',
  },
];

const INSTALL_ACTION: DeployAction = {
  id: 'installWfCli',
  label: 'Install Workflow CLI',
  description: 'npm install -g @burgan-tech/vnext-workflow-cli',
  icon: 'desktop-download',
  command: 'vnextForge.tools.installWfCli',
};

const WF_COMMANDS: Record<string, string> = {
  wfUpdateAll: 'wf update --all',
  wfUpdate: 'wf update',
  wfCsxAll: 'wf csx --all',
};

export class PackageDeployProvider implements vscode.TreeDataProvider<DeployNodeId> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<DeployNodeId | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private wfInstalled: boolean | undefined;

  constructor(
    private readonly detector: VnextWorkspaceDetector,
    private readonly terminal: ForgeTerminalManager,
  ) {}

  getTreeItem(element: DeployNodeId): vscode.TreeItem {
    const action = element === 'installWfCli'
      ? INSTALL_ACTION
      : DEPLOY_ACTIONS.find((a) => a.id === element)!;

    const item = new vscode.TreeItem(action.label, vscode.TreeItemCollapsibleState.None);
    item.description = action.description;
    item.iconPath = new vscode.ThemeIcon(action.icon);
    item.command = {
      command: action.command,
      title: action.label,
    };
    return item;
  }

  async getChildren(element?: DeployNodeId): Promise<DeployNodeId[]> {
    if (element) return [];

    if (this.wfInstalled === undefined) {
      this.wfInstalled = await this.checkWfInstalled();
    }

    if (!this.wfInstalled) {
      return ['installWfCli'];
    }

    return DEPLOY_ACTIONS.map((a) => a.id);
  }

  async runDeployAction(actionId: DeployNodeId): Promise<void> {
    if (actionId === 'installWfCli') {
      await this.installWfCli();
      return;
    }

    const installed = await this.checkWfInstalled();
    if (!installed) {
      const action = await vscode.window.showWarningMessage(
        'vnext-forge: Workflow CLI (wf) is not installed.',
        'Install Now',
      );
      if (action === 'Install Now') {
        await this.installWfCli();
      }
      return;
    }

    const roots = this.detector.getRoots();
    if (roots.length === 0) {
      void vscode.window.showWarningMessage('vnext-forge: No vnext workspace found.');
      return;
    }

    const cwd = roots[0].folderPath;
    const command = WF_COMMANDS[actionId];
    if (!command) return;

    this.terminal.run(command, { cwd });
  }

  private async installWfCli(): Promise<void> {
    this.terminal.run('npm install -g @burgan-tech/vnext-workflow-cli');

    void vscode.window.showInformationMessage(
      'vnext-forge: Installing Workflow CLI globally. Refresh the sidebar after installation completes.',
    );

    this.wfInstalled = undefined;
    this._onDidChangeTreeData.fire(undefined);
  }

  async refreshInstallStatus(): Promise<void> {
    this.wfInstalled = await this.checkWfInstalled();
    this._onDidChangeTreeData.fire(undefined);
  }

  private checkWfInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile('wf', ['--version'], {
        timeout: 10_000,
        shell: process.platform === 'win32',
      }, (error) => {
        if (error) {
          baseLogger.info({}, 'wf CLI not found');
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
}
