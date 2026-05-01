import * as vscode from 'vscode';
import type {
  ForgeToolsSettingsService,
  RuntimeEnvironment,
  EnvironmentsConfig,
} from '../forge-tools-settings.js';
import type { EnvironmentHealthMonitor, HealthStatus } from '../environment-health-monitor.js';

export class EnvironmentsProvider implements vscode.TreeDataProvider<string> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private envConfig: EnvironmentsConfig | undefined;

  constructor(
    private readonly settingsService: ForgeToolsSettingsService,
    private readonly healthMonitor: EnvironmentHealthMonitor,
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

    await this.settingsService.addEnvironment(name.trim(), baseUrl.trim());
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

  private buildTooltip(env: RuntimeEnvironment, isActive: boolean, health?: HealthStatus): string {
    const lines = [
      `Name: ${env.name}`,
      `URL: ${env.baseUrl}`,
      `Status: ${isActive ? 'Active' : 'Inactive'}`,
    ];
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
