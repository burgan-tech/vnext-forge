import * as vscode from 'vscode';
import type {
  ForgeToolsSettingsService,
  ForgeSettings,
  QuickRunSettings,
  LayoutAlgorithm,
  LayoutDirection,
  EdgePathStyle,
  ThemeMode,
} from '../forge-tools-settings.js';

type SettingNodeId =
  | 'canvas'
  | 'canvas.algorithm'
  | 'canvas.direction'
  | 'canvas.edgePathStyle'
  | 'theme'
  | 'theme.mode'
  | 'editor'
  | 'editor.autoSave'
  | 'pseudoUi'
  | 'pseudoUi.enabled'
  | 'pseudoUi.url'
  | 'pseudoUi.localFile'
  | 'pseudoUi.clear'
  | 'quickrun'
  | 'quickrun.retryCount'
  | 'quickrun.intervalMs';

interface SettingNode {
  id: SettingNodeId;
  label: string;
  parentId?: SettingNodeId;
  getValue: (s: ForgeSettings, qr: QuickRunSettings) => string;
}

const SETTING_NODES: SettingNode[] = [
  { id: 'canvas', label: 'Canvas', getValue: () => '' },
  { id: 'canvas.algorithm', label: 'Layout Algorithm', parentId: 'canvas', getValue: (s) => s.canvas.algorithm },
  { id: 'canvas.direction', label: 'Layout Direction', parentId: 'canvas', getValue: (s) => s.canvas.direction },
  { id: 'canvas.edgePathStyle', label: 'Edge Path Style', parentId: 'canvas', getValue: (s) => s.canvas.edgePathStyle },
  { id: 'theme', label: 'Theme', getValue: () => '' },
  { id: 'theme.mode', label: 'Mode', parentId: 'theme', getValue: (s) => s.themeMode },
  { id: 'editor', label: 'Editor', getValue: () => '' },
  { id: 'editor.autoSave', label: 'Auto Save', parentId: 'editor', getValue: (s) => (s.autoSaveEnabled ? 'Enabled' : 'Disabled') },
  { id: 'pseudoUi', label: 'Pseudo UI', getValue: () => '' },
  { id: 'pseudoUi.enabled', label: 'Tenant Stylesheet', parentId: 'pseudoUi', getValue: (s) => (s.pseudoUiTenantStyle.enabled ? 'Enabled' : 'Disabled') },
  { id: 'pseudoUi.url', label: 'Stylesheet URL', parentId: 'pseudoUi', getValue: (s) => (s.pseudoUiTenantStyle.sourceType === 'url' ? s.pseudoUiTenantStyle.value || 'Not set' : 'Not active') },
  { id: 'pseudoUi.localFile', label: 'Local CSS File', parentId: 'pseudoUi', getValue: (s) => (s.pseudoUiTenantStyle.sourceType === 'localFile' ? s.pseudoUiTenantStyle.value || 'Not set' : 'Not active') },
  { id: 'pseudoUi.clear', label: 'Clear Stylesheet', parentId: 'pseudoUi', getValue: () => '' },
  { id: 'quickrun', label: 'Quick Run Polling', getValue: () => '' },
  { id: 'quickrun.retryCount', label: 'Retry Count', parentId: 'quickrun', getValue: (_s, qr) => String(qr.polling.retryCount) },
  { id: 'quickrun.intervalMs', label: 'Interval (ms)', parentId: 'quickrun', getValue: (_s, qr) => String(qr.polling.intervalMs) },
];

const ALGORITHM_OPTIONS: { label: string; value: LayoutAlgorithm }[] = [
  { label: 'Dagre', value: 'dagre' },
  { label: 'ELK', value: 'elk' },
];

const DIRECTION_OPTIONS: { label: string; value: LayoutDirection }[] = [
  { label: 'Top to Bottom', value: 'DOWN' },
  { label: 'Left to Right', value: 'RIGHT' },
];

const EDGE_STYLE_OPTIONS: { label: string; value: EdgePathStyle }[] = [
  { label: 'Smooth Step', value: 'smoothstep' },
  { label: 'Bezier', value: 'bezier' },
  { label: 'Straight', value: 'straight' },
];

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
];

export class GlobalSettingsProvider implements vscode.TreeDataProvider<SettingNodeId> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<SettingNodeId | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private settings: ForgeSettings | undefined;
  private quickRunSettings: QuickRunSettings | undefined;

  constructor(private readonly settingsService: ForgeToolsSettingsService) {
    settingsService.onDidChangeSettings(() => {
      this.settings = undefined;
      this.quickRunSettings = undefined;
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  async getTreeItem(element: SettingNodeId): Promise<vscode.TreeItem> {
    const node = SETTING_NODES.find((n) => n.id === element);
    if (!node) return new vscode.TreeItem('Unknown');
    const isParent = SETTING_NODES.some((n) => n.parentId === element);
    const settings = await this.getSettings();
    const qrSettings = await this.getQuickRunSettings();

    const item = new vscode.TreeItem(
      node.label,
      isParent ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );

    if (!isParent) {
      item.description = node.getValue(settings, qrSettings);
      item.contextValue = 'settingItem';
      item.command = {
        command: 'vnextForge.tools.changeSetting',
        title: 'Change',
        arguments: [element],
      };
      item.iconPath = new vscode.ThemeIcon('settings-gear');
    } else {
      if (element === 'canvas') {
        item.iconPath = new vscode.ThemeIcon('symbol-misc');
      } else if (element === 'theme') {
        item.iconPath = new vscode.ThemeIcon('color-mode');
      } else if (element === 'editor') {
        item.iconPath = new vscode.ThemeIcon('edit');
      } else if (element === 'pseudoUi') {
        item.iconPath = new vscode.ThemeIcon('symbol-color');
      } else if (element === 'quickrun') {
        item.iconPath = new vscode.ThemeIcon('debug-start');
      }
    }

    return item;
  }

  getChildren(element?: SettingNodeId): SettingNodeId[] {
    if (!element) {
      return SETTING_NODES.filter((n) => !n.parentId).map((n) => n.id);
    }
    return SETTING_NODES.filter((n) => n.parentId === element).map((n) => n.id);
  }

  getParent(element: SettingNodeId): SettingNodeId | undefined {
    return SETTING_NODES.find((n) => n.id === element)?.parentId;
  }

  async handleChangeSetting(settingId: SettingNodeId): Promise<void> {
    const settings = await this.getSettings();

    switch (settingId) {
      case 'canvas.algorithm': {
        const picked = await vscode.window.showQuickPick(
          ALGORITHM_OPTIONS.map((o) => ({
            label: o.label,
            description: o.value === settings.canvas.algorithm ? '(current)' : '',
            value: o.value,
          })),
          { title: 'Select Layout Algorithm' },
        );
        if (picked) {
          await this.settingsService.saveSettings({ canvas: { ...settings.canvas, algorithm: picked.value } });
        }
        break;
      }
      case 'canvas.direction': {
        const picked = await vscode.window.showQuickPick(
          DIRECTION_OPTIONS.map((o) => ({
            label: o.label,
            description: o.value === settings.canvas.direction ? '(current)' : '',
            value: o.value,
          })),
          { title: 'Select Layout Direction' },
        );
        if (picked) {
          await this.settingsService.saveSettings({ canvas: { ...settings.canvas, direction: picked.value } });
        }
        break;
      }
      case 'canvas.edgePathStyle': {
        const picked = await vscode.window.showQuickPick(
          EDGE_STYLE_OPTIONS.map((o) => ({
            label: o.label,
            description: o.value === settings.canvas.edgePathStyle ? '(current)' : '',
            value: o.value,
          })),
          { title: 'Select Edge Path Style' },
        );
        if (picked) {
          await this.settingsService.saveSettings({ canvas: { ...settings.canvas, edgePathStyle: picked.value } });
        }
        break;
      }
      case 'theme.mode': {
        const picked = await vscode.window.showQuickPick(
          THEME_OPTIONS.map((o) => ({
            label: o.label,
            description: o.value === settings.themeMode ? '(current)' : '',
            value: o.value,
          })),
          { title: 'Select Theme Mode' },
        );
        if (picked) {
          await this.settingsService.saveSettings({ themeMode: picked.value });
        }
        break;
      }
      case 'editor.autoSave': {
        const picked = await vscode.window.showQuickPick(
          [
            { label: 'Enable', description: settings.autoSaveEnabled ? '(current)' : '', value: true },
            { label: 'Disable', description: !settings.autoSaveEnabled ? '(current)' : '', value: false },
          ],
          { title: 'Enable Auto Save' },
        );
        if (picked != null) {
          await this.settingsService.saveSettings({ autoSaveEnabled: picked.value });
        }
        break;
      }
      case 'pseudoUi.enabled': {
        const picked = await vscode.window.showQuickPick(
          [
            { label: 'Enable', description: settings.pseudoUiTenantStyle.enabled ? '(current)' : '', value: true },
            { label: 'Disable', description: !settings.pseudoUiTenantStyle.enabled ? '(current)' : '', value: false },
          ],
          { title: 'Enable Pseudo UI Tenant Stylesheet' },
        );
        if (picked != null) {
          await this.settingsService.saveSettings({
            pseudoUiTenantStyle: { ...settings.pseudoUiTenantStyle, enabled: picked.value },
          });
        }
        break;
      }
      case 'pseudoUi.url': {
        const input = await vscode.window.showInputBox({
          title: 'Pseudo UI Stylesheet URL',
          prompt: 'Enter an HTTP(S) stylesheet URL',
          value: settings.pseudoUiTenantStyle.sourceType === 'url' ? settings.pseudoUiTenantStyle.value : '',
          validateInput: (v) => {
            if (!v.trim()) return undefined;
            try {
              const url = new URL(v.trim());
              if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return 'Enter an HTTP or HTTPS URL';
              }
            } catch {
              return 'Enter a valid URL';
            }
            return undefined;
          },
        });
        if (input != null) {
          await this.settingsService.saveSettings({
            pseudoUiTenantStyle: {
              enabled: Boolean(input.trim()),
              sourceType: 'url',
              value: input.trim(),
            },
          });
        }
        break;
      }
      case 'pseudoUi.localFile': {
        const picked = await vscode.window.showOpenDialog({
          title: 'Select Pseudo UI Stylesheet',
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { CSS: ['css'] },
        });
        const file = picked?.[0];
        if (file) {
          await this.settingsService.saveSettings({
            pseudoUiTenantStyle: {
              enabled: true,
              sourceType: 'localFile',
              value: file.fsPath,
            },
          });
        }
        break;
      }
      case 'pseudoUi.clear': {
        await this.settingsService.saveSettings({
          pseudoUiTenantStyle: {
            enabled: false,
            sourceType: 'url',
            value: '',
          },
        });
        break;
      }
      case 'quickrun.retryCount': {
        const qr = await this.getQuickRunSettings();
        const input = await vscode.window.showInputBox({
          title: 'Polling Retry Count',
          prompt: 'Number of polling attempts for state function',
          value: String(qr.polling.retryCount),
          validateInput: (v) => {
            const n = Number(v);
            if (!Number.isInteger(n) || n < 1) return 'Enter a positive integer';
            return undefined;
          },
        });
        if (input != null) {
          await this.settingsService.saveQuickRunSettings({ polling: { ...qr.polling, retryCount: Number(input) } });
          this.quickRunSettings = undefined;
          this._onDidChangeTreeData.fire(undefined);
        }
        break;
      }
      case 'quickrun.intervalMs': {
        const qr = await this.getQuickRunSettings();
        const input = await vscode.window.showInputBox({
          title: 'Polling Interval (ms)',
          prompt: 'Delay in milliseconds between state function polls',
          value: String(qr.polling.intervalMs),
          validateInput: (v) => {
            const n = Number(v);
            if (!Number.isInteger(n) || n < 0) return 'Enter a non-negative integer';
            return undefined;
          },
        });
        if (input != null) {
          await this.settingsService.saveQuickRunSettings({ polling: { ...qr.polling, intervalMs: Number(input) } });
          this.quickRunSettings = undefined;
          this._onDidChangeTreeData.fire(undefined);
        }
        break;
      }
    }
  }

  private async getSettings(): Promise<ForgeSettings> {
    this.settings ??= await this.settingsService.loadSettings();
    return this.settings;
  }

  private async getQuickRunSettings(): Promise<QuickRunSettings> {
    this.quickRunSettings ??= await this.settingsService.loadQuickRunSettings();
    return this.quickRunSettings;
  }
}
