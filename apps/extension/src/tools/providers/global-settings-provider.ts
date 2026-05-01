import * as vscode from 'vscode';
import type {
  ForgeToolsSettingsService,
  ForgeSettings,
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
  | 'theme.mode';

interface SettingNode {
  id: SettingNodeId;
  label: string;
  parentId?: SettingNodeId;
  getValue: (s: ForgeSettings) => string;
}

const SETTING_NODES: SettingNode[] = [
  { id: 'canvas', label: 'Canvas', getValue: () => '' },
  { id: 'canvas.algorithm', label: 'Layout Algorithm', parentId: 'canvas', getValue: (s) => s.canvas.algorithm },
  { id: 'canvas.direction', label: 'Layout Direction', parentId: 'canvas', getValue: (s) => s.canvas.direction },
  { id: 'canvas.edgePathStyle', label: 'Edge Path Style', parentId: 'canvas', getValue: (s) => s.canvas.edgePathStyle },
  { id: 'theme', label: 'Theme', getValue: () => '' },
  { id: 'theme.mode', label: 'Mode', parentId: 'theme', getValue: (s) => s.themeMode },
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

  constructor(private readonly settingsService: ForgeToolsSettingsService) {
    settingsService.onDidChangeSettings(() => {
      this.settings = undefined;
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  async getTreeItem(element: SettingNodeId): Promise<vscode.TreeItem> {
    const node = SETTING_NODES.find((n) => n.id === element);
    if (!node) return new vscode.TreeItem('Unknown');
    const isParent = SETTING_NODES.some((n) => n.parentId === element);
    const settings = await this.getSettings();

    const item = new vscode.TreeItem(
      node.label,
      isParent ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );

    if (!isParent) {
      item.description = node.getValue(settings);
      item.contextValue = 'settingItem';
      item.command = {
        command: 'vnextForge.tools.changeSetting',
        title: 'Change',
        arguments: [element],
      };
      item.iconPath = new vscode.ThemeIcon('settings-gear');
    } else {
      item.iconPath = element === 'canvas'
        ? new vscode.ThemeIcon('symbol-misc')
        : new vscode.ThemeIcon('color-mode');
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
    }
  }

  private async getSettings(): Promise<ForgeSettings> {
    if (!this.settings) {
      this.settings = await this.settingsService.loadSettings();
    }
    return this.settings;
  }
}
