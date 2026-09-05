import * as vscode from 'vscode';

import {
  buildWfShellCommand,
  type VnextSolutionFile,
  type WfWorkspaceCommand,
} from '@vnext-forge-studio/services-core';

import type { VnextWorkspaceDetector } from '../../workspace-detector.js';
import type { ForgeTerminalManager } from '../forge-terminal.js';
import { pickWorkspaceRoot } from '../pick-workspace-root.js';
import type { WfCliProbe } from '../wf-cli-probe.js';
import type { WfCliUpgradeNotice } from '../wf-cli-upgrade-notice.js';

type DeployNodeId = 'wfUpdateAll' | 'wfUpdate' | 'wfCsxAll' | 'installWfCli';
type DeployCommandId = Exclude<DeployNodeId, 'installWfCli'>;

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

const WF_COMMANDS: Record<DeployCommandId, WfWorkspaceCommand> = {
  wfUpdateAll: 'update --all',
  wfUpdate: 'update',
  wfCsxAll: 'csx --all',
};

const ALL_DOMAINS_LABEL = 'All domains';

export class PackageDeployProvider implements vscode.TreeDataProvider<DeployNodeId> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<DeployNodeId | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly detector: VnextWorkspaceDetector,
    private readonly terminal: ForgeTerminalManager,
    private readonly wfCli: WfCliProbe,
    private readonly upgradeNotice: WfCliUpgradeNotice,
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

    const info = await this.wfCli.get();
    if (!info.installed) {
      return ['installWfCli'];
    }

    return DEPLOY_ACTIONS.map((a) => a.id);
  }

  async runDeployAction(actionId: DeployNodeId): Promise<void> {
    if (actionId === 'installWfCli') {
      await this.installWfCli();
      return;
    }

    const info = await this.wfCli.get();
    if (!info.installed) {
      const action = await vscode.window.showWarningMessage(
        'vnext-forge-studio: Workflow CLI (wf) is not installed.',
        'Install Now',
      );
      if (action === 'Install Now') {
        await this.installWfCli();
      }
      return;
    }

    const roots = this.detector.getRoots();
    if (roots.length === 0) {
      void vscode.window.showWarningMessage('vnext-forge-studio: No vnext workspace found.');
      return;
    }
    const root = await pickWorkspaceRoot(roots, {
      title: 'Select vNext workspace',
      placeHolder: 'Several vNext roots are open — pick the one to deploy from.',
    });
    if (!root) return;

    // Multi-domain root: let the user narrow the run to one solution. With a
    // legacy CLI "All domains" is not offered — it cannot iterate solutions.
    const validSolutions = root.solutions.filter(
      (solution) => solution.status.status === 'ok' && !!solution.config,
    );
    let domain: string | undefined;
    if (validSolutions.length > 1) {
      const picked = await this.pickDomain(validSolutions, info.supportsDomainFlag);
      if (picked === undefined) return;
      domain = picked || undefined;
    }

    const command = buildWfShellCommand(
      { base: WF_COMMANDS[actionId] },
      { domain, cliSupportsDomainFlag: info.supportsDomainFlag },
    );
    if (domain && !info.supportsDomainFlag) {
      void this.upgradeNotice.maybeShow(info);
    }

    this.terminal.run(command, { cwd: root.folderPath });
  }

  /** `''` = all domains, a domain name = one solution, `undefined` = cancelled. */
  private async pickDomain(
    solutions: readonly VnextSolutionFile[],
    offerAllDomains: boolean,
  ): Promise<string | undefined> {
    const domains = solutions.map((solution) => solution.config!.domain);
    const items: (vscode.QuickPickItem & { domain: string })[] = [];
    if (offerAllDomains) {
      items.push({
        label: ALL_DOMAINS_LABEL,
        description: domains.join(', '),
        detail: 'Run once per solution file, sequentially (Workflow CLI default).',
        domain: '',
      });
    }
    for (const solution of solutions) {
      const config = solution.config!;
      items.push({
        label: config.domain,
        description: solution.fileName,
        ...(config.description ? { detail: config.description } : {}),
        domain: config.domain,
      });
    }
    const picked = await vscode.window.showQuickPick(items, {
      title: 'Deploy: select domain',
      placeHolder: 'This workspace holds several solution files — pick the domain to deploy.',
      ignoreFocusOut: true,
    });
    return picked?.domain;
  }

  installWfCli(): Promise<void> {
    this.terminal.run('npm install -g @burgan-tech/vnext-workflow-cli');

    void vscode.window.showInformationMessage(
      'vnext-forge-studio: Installing Workflow CLI globally. Refresh the sidebar after installation completes.',
    );

    this.wfCli.invalidate();
    this._onDidChangeTreeData.fire(undefined);
    return Promise.resolve();
  }

  refreshInstallStatus(): Promise<void> {
    this.wfCli.invalidate();
    this._onDidChangeTreeData.fire(undefined);
    return Promise.resolve();
  }
}
