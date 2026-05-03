import * as vscode from 'vscode';
import type { EnvironmentHealthMonitor, HealthStatus } from './environment-health-monitor.js';
import type { ForgeToolsSettingsService, RuntimeEnvironment } from './forge-tools-settings.js';

const SIDEBAR_VIEW_COMMAND = 'workbench.view.extension.vnextForgeTools';

export class EnvironmentStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly settingsService: ForgeToolsSettingsService,
    private readonly healthMonitor: EnvironmentHealthMonitor,
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    this.disposables.push(
      this.item,
      healthMonitor.onDidChangeHealth(() => void this.update()),
      settingsService.onDidChangeEnvironments(() => void this.update()),
    );
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }

  async initialize(): Promise<void> {
    await this.update();
    this.item.show();
  }

  private async update(): Promise<void> {
    const env = await this.settingsService.getActiveEnvironment();

    if (!env) {
      this.item.text = '$(warning) No Environment';
      this.item.tooltip = 'vNext Forge: No runtime environment configured. Click to open Tools.';
      this.item.command = SIDEBAR_VIEW_COMMAND;
      this.item.backgroundColor = undefined;
      this.item.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      this.item.show();
      return;
    }

    const health = this.healthMonitor.getHealth();
    this.item.text = `${this.getHealthIcon(health)} ${env.name}`;
    this.item.tooltip = this.buildTooltip(env, health);
    this.item.command = 'vnextForge.tools.switchEnvironment';
    this.item.color = undefined;
    this.item.backgroundColor = this.getBackgroundColor(health);
    this.item.show();
  }

  private getHealthIcon(health: HealthStatus): string {
    switch (health) {
      case 'healthy':
        return '$(circle-large-filled)';
      case 'unhealthy':
        return '$(error)';
      case 'checking':
        return '$(loading~spin)';
      default:
        return '$(circle-large-outline)';
    }
  }

  private getBackgroundColor(health: HealthStatus): vscode.ThemeColor | undefined {
    switch (health) {
      case 'unhealthy':
        return new vscode.ThemeColor('statusBarItem.errorBackground');
      default:
        return undefined;
    }
  }

  private buildTooltip(env: RuntimeEnvironment, health: HealthStatus): string {
    const version = this.healthMonitor.getRuntimeVersion();
    const healthDisplay = version ? `${health} (v${version})` : health;
    const lines = [
      `vNext Forge Runtime Environment`,
      `Name: ${env.name}`,
      `URL: ${env.baseUrl}`,
      `Health: ${healthDisplay}`,
    ];
    return lines.join('\n');
  }
}

/**
 * Shows a QuickPick to switch the active environment, or opens the Tools
 * sidebar if no environments are configured.
 */
export async function switchEnvironmentQuickPick(
  settingsService: ForgeToolsSettingsService,
): Promise<void> {
  const config = await settingsService.loadEnvironments();
  if (config.environments.length === 0) {
    await vscode.commands.executeCommand(SIDEBAR_VIEW_COMMAND);
    return;
  }

  const items = config.environments.map((env) => ({
    label: env.name,
    description: env.baseUrl,
    picked: env.id === config.activeEnvironmentId,
    envId: env.id,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Switch Runtime Environment',
    placeHolder: 'Select environment',
  });

  if (picked) {
    await settingsService.setActiveEnvironment(picked.envId);
  }
}
