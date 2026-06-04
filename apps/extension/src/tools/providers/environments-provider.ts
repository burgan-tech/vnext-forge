import * as vscode from 'vscode';
import type {
  ForgeToolsSettingsService,
  RuntimeEnvironment,
  EnvironmentsConfig,
} from '../forge-tools-settings.js';
import type { EnvironmentHealthMonitor, HealthStatus } from '../environment-health-monitor.js';
import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from '../../workspace-detector.js';
import { baseLogger } from '../../shared/logger.js';

/**
 * Resolves the workspace domain from `vnext.config.json` (single source
 * of truth for everything that talks to the engine / CLI). The function
 * stays a pluggable async hook so tests don't need to spin up a real
 * `WorkspaceService`.
 */
export type ResolveWorkspaceDomainFn = (root: VnextWorkspaceRoot) => Promise<string>;

const WORKFLOW_CLI_DOCS_URL = 'https://burgan-tech.github.io/vnext-docs/docs/tools/workflow-cli';

export type DomainAddFn = (params: {
  domainName: string;
  apiBaseUrl: string;
  dbName: string;
}) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export class EnvironmentsProvider implements vscode.TreeDataProvider<string> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private envConfig: EnvironmentsConfig | undefined;

  constructor(
    private readonly settingsService: ForgeToolsSettingsService,
    private readonly healthMonitor: EnvironmentHealthMonitor,
    private readonly domainAdd?: DomainAddFn,
    private readonly detector?: VnextWorkspaceDetector,
    private readonly resolveWorkspaceDomain?: ResolveWorkspaceDomainFn,
  ) {
    settingsService.onDidChangeEnvironments(() => {
      this.envConfig = undefined;
      this._onDidChangeTreeData.fire(undefined);
    });
    healthMonitor.onDidChangeHealth(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  async getTreeItem(element: string): Promise<vscode.TreeItem> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === element);
    if (!env) {
      return new vscode.TreeItem('Unknown');
    }

    const isActive = config.activeEnvironmentId === env.id;
    const health = isActive ? this.healthMonitor.getHealth() : undefined;

    const item = new vscode.TreeItem(env.name, vscode.TreeItemCollapsibleState.None);
    item.description = env.baseUrl;
    item.contextValue = 'environment';
    item.tooltip = this.buildTooltip(env, isActive, health);
    item.iconPath = this.getHealthIcon(isActive, health);

    if (!isActive) {
      item.command = {
        command: 'vnextForge.tools.setActiveEnvironment',
        title: 'Set Active',
        arguments: [element],
      };
    }

    return item;
  }

  async getChildren(element?: string): Promise<string[]> {
    if (element) return [];
    const config = await this.getConfig();
    return config.environments.map((e) => e.id);
  }

  async addEnvironment(): Promise<void> {
    const name = await vscode.window.showInputBox({
      title: 'Add Environment',
      prompt: 'Environment name (e.g. Local, Test, Staging)',
      placeHolder: 'Local',
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
      ignoreFocusOut: true,
    });
    if (!name) return;

    const baseUrl = await vscode.window.showInputBox({
      title: 'Add Environment',
      prompt: 'Base URL of the vNext platform',
      placeHolder: 'http://localhost:4201',
      value: 'http://localhost:4201',
      validateInput: (v) => {
        try {
          new URL(v.trim());
          return null;
        } catch {
          return 'Enter a valid URL (e.g. http://localhost:4201)';
        }
      },
      ignoreFocusOut: true,
    });
    if (!baseUrl) return;

    // Resolve the workspace domain BEFORE the DB Name prompt so the
    // default value (`vNext_<DOMAIN>`) reflects vnext.config.json, not
    // the environment label. We still let the user override the DB
    // Name — leaving the field empty (or unchanged from the
    // placeholder) yields the auto-derived value.
    const workspaceDomain = await this.pickWorkspaceDomain();
    if (workspaceDomain === undefined) return; // user cancelled

    // Lowercase domain preserves the runtime/CLI convention (the
    // workspace's `vnext.config.json` `domain` is also lowercased).
    const defaultDbName = workspaceDomain
      ? `vNext_${workspaceDomain.toLowerCase()}`
      : `vNext_${name.trim().replace(/\s+/g, '_').toLowerCase()}`;
    const dbName = await vscode.window.showInputBox({
      title: 'Add Environment',
      prompt: workspaceDomain
        ? `Database name for Workflow CLI domain (defaults to vNext_<domain> from vnext.config.json: domain="${workspaceDomain}")`
        : 'Database name for Workflow CLI domain',
      placeHolder: defaultDbName,
      value: defaultDbName,
      validateInput: (v) => (v.trim() ? null : 'Database name is required'),
      ignoreFocusOut: true,
    });
    if (!dbName) return;

    await this.settingsService.addEnvironment(name.trim(), baseUrl.trim(), dbName.trim());
    // The wf CLI domain argument is the workspace domain (read from
    // vnext.config.json), NOT the environment label. Same domain can
    // be registered with multiple environment URLs (e.g. Local +
    // Staging both target domain "core" with different base URLs).
    const cliDomain = workspaceDomain || name.trim();
    await this.runDomainAdd(cliDomain, baseUrl.trim(), dbName.trim(), name.trim());
  }

  /**
   * Resolve the wf CLI domain argument from vnext.config.json.
   *
   * - 0 roots → return `''` (caller falls back to the environment label
   *   so the legacy path still works for users without a workspace).
   * - 1 root → read its config and return `config.domain`.
   * - 2+ roots → present a QuickPick so the user picks which workspace
   *   the environment registration targets. Returns `undefined` if the
   *   user dismisses the picker (so the caller can abort the flow).
   *
   * Returns `''` (not `undefined`) on read failure — the environment can
   * still be persisted; only the wf CLI fallback shifts to using the
   * environment name as the domain argument.
   */
  private async pickWorkspaceDomain(): Promise<string | undefined> {
    if (!this.detector || !this.resolveWorkspaceDomain) return '';
    const roots = this.detector.getRoots();
    if (roots.length === 0) return '';
    let chosen: VnextWorkspaceRoot;
    if (roots.length === 1) {
      chosen = roots[0];
    } else {
      const pick = await vscode.window.showQuickPick(
        roots.map((r) => ({
          label: r.folderPath.split(/[\\/]/).pop() ?? r.folderPath,
          description: r.folderPath,
          root: r,
        })),
        {
          title: 'Select vNext workspace for the new environment',
          placeHolder: 'Pick the workspace whose `vnext.config.json` `domain` will be used.',
          ignoreFocusOut: true,
        },
      );
      if (!pick) return undefined;
      chosen = pick.root;
    }
    try {
      const domain = await this.resolveWorkspaceDomain(chosen);
      return domain.trim();
    } catch (err) {
      baseLogger.warn(
        { folder: chosen.folderPath, error: (err as Error).message },
        'Failed to read vnext.config.json domain; falling back to environment label.',
      );
      return '';
    }
  }

  async editEnvironment(envId: string): Promise<void> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === envId);
    if (!env) return;

    const name = await vscode.window.showInputBox({
      title: 'Edit Environment',
      prompt: 'Environment name',
      value: env.name,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
      ignoreFocusOut: true,
    });
    if (!name) return;

    const baseUrl = await vscode.window.showInputBox({
      title: 'Edit Environment',
      prompt: 'Base URL',
      value: env.baseUrl,
      validateInput: (v) => {
        try {
          new URL(v.trim());
          return null;
        } catch {
          return 'Enter a valid URL';
        }
      },
      ignoreFocusOut: true,
    });
    if (!baseUrl) return;

    await this.settingsService.updateEnvironment(envId, {
      name: name.trim(),
      baseUrl: baseUrl.trim(),
    });

    const action = await vscode.window.showInformationMessage(
      'For advanced Workflow CLI configuration (DB host, credentials, Docker, etc.), see the CLI docs.',
      'View CLI Docs',
    );
    if (action === 'View CLI Docs') {
      void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
    }
  }

  async deleteEnvironment(envId: string): Promise<void> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === envId);
    if (!env) return;

    const confirm = await vscode.window.showWarningMessage(
      `Delete environment "${env.name}"?`,
      { modal: true },
      'Delete',
    );
    if (confirm !== 'Delete') return;

    await this.settingsService.removeEnvironment(envId);
  }

  async setActiveEnvironment(envId: string): Promise<void> {
    await this.settingsService.setActiveEnvironment(envId);
  }

  private async getConfig(): Promise<EnvironmentsConfig> {
    if (!this.envConfig) {
      this.envConfig = await this.settingsService.loadEnvironments();
    }
    return this.envConfig;
  }

  private async runDomainAdd(
    cliDomain: string,
    baseUrl: string,
    dbName: string,
    /** Environment label — used only for the success/error notification. */
    envLabel: string,
  ): Promise<void> {
    if (!this.domainAdd) return;
    try {
      const result = await this.domainAdd({ domainName: cliDomain, apiBaseUrl: baseUrl, dbName });
      if (result.exitCode === 0) {
        const action = await vscode.window.showInformationMessage(
          `Workflow CLI domain "${cliDomain}" registered for environment "${envLabel}".`,
          'View CLI Docs',
        );
        if (action === 'View CLI Docs') {
          void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
        }
      } else {
        const msg = result.stderr.trim() || result.stdout.trim() || 'Unknown error';
        const action = await vscode.window.showWarningMessage(
          `Workflow CLI domain registration failed: ${msg}`,
          'View CLI Docs',
        );
        if (action === 'View CLI Docs') {
          void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
        }
      }
    } catch {
      const action = await vscode.window.showWarningMessage(
        'Workflow CLI is not available. Install it to enable domain registration.',
        'View CLI Docs',
      );
      if (action === 'View CLI Docs') {
        void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
      }
    }
  }

  private buildTooltip(env: RuntimeEnvironment, isActive: boolean, health?: HealthStatus): string {
    const lines = [
      `Name: ${env.name}`,
      `URL: ${env.baseUrl}`,
      `Status: ${isActive ? 'Active' : 'Inactive'}`,
    ];
    if (env.dbName) {
      lines.push(`DB Name: ${env.dbName}`);
    }
    if (health) {
      lines.push(`Health: ${health}`);
    }
    return lines.join('\n');
  }

  private getHealthIcon(isActive: boolean, health?: HealthStatus): vscode.ThemeIcon {
    if (!isActive) return new vscode.ThemeIcon('circle-outline');
    switch (health) {
      case 'healthy':
        return new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconPassed'));
      case 'unhealthy':
        return new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconFailed'));
      case 'checking':
        return new vscode.ThemeIcon('loading~spin');
      default:
        return new vscode.ThemeIcon('circle-large-outline');
    }
  }
}
