import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import type { ResolvedConfigPath } from '../forge-config-locator.js';
import { looksSecret, stripHeaderValues } from '../forge-config-bundle.js';
import { confirmWorkspaceHeaderWrite } from '../forge-config-share.js';
import type {
  ForgeToolsSettingsService,
  ForgeSettings,
  QuickRunSettings,
  ShareableConfigBucket,
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
  | 'quickrun.globalHeaders'
  | 'quickrun.retryCount'
  | 'quickrun.intervalMs'
  | 'source'
  | 'source.quickRun'
  | 'source.environments'
  | 'source.tenantStyle';

type ConfigSources = Record<ShareableConfigBucket, ResolvedConfigPath>;

interface SettingNode {
  id: SettingNodeId;
  label: string;
  parentId?: SettingNodeId;
  getValue: (s: ForgeSettings, qr: QuickRunSettings, sources: ConfigSources) => string;
}

/** Source-node → the bucket whose resolution it reports. */
const SOURCE_NODE_BUCKETS: Partial<Record<SettingNodeId, ShareableConfigBucket>> = {
  'source.quickRun': 'quickRun',
  'source.environments': 'environments',
  'source.tenantStyle': 'tenantStyle',
};

/**
 * `Workspace` reads as "shared with the team through the repo".
 *
 * The local case names the next step rather than just stating a fact: a
 * developer who has never shared has no way to tell, from the word "local",
 * that sharing is a thing this row can do.
 */
function sourceLabel(resolved: ResolvedConfigPath): string {
  return resolved.source === 'workspace' ? 'Workspace' : 'This machine — click to share';
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
  { id: 'quickrun', label: 'Quick Run', getValue: () => '' },
  {
    id: 'quickrun.globalHeaders',
    label: 'Global Headers',
    parentId: 'quickrun',
    getValue: (_s, qr) =>
      qr.globalHeaders.length === 0
        ? 'None'
        : `${qr.globalHeaders.length} header${qr.globalHeaders.length === 1 ? '' : 's'}`,
  },
  { id: 'quickrun.retryCount', label: 'Retry Count', parentId: 'quickrun', getValue: (_s, qr) => String(qr.polling.retryCount) },
  { id: 'quickrun.intervalMs', label: 'Interval (ms)', parentId: 'quickrun', getValue: (_s, qr) => String(qr.polling.intervalMs) },
  // Which copy of each shared bucket is in play. Without this, "workspace wins"
  // is invisible — a header coming from a teammate's committed file looks
  // identical to one you set yourself.
  { id: 'source', label: 'Config Source', getValue: () => '' },
  { id: 'source.quickRun', label: 'Headers & Polling', parentId: 'source', getValue: (_s, _qr, src) => sourceLabel(src.quickRun) },
  { id: 'source.environments', label: 'Environments', parentId: 'source', getValue: (_s, _qr, src) => sourceLabel(src.environments) },
  { id: 'source.tenantStyle', label: 'Tenant Stylesheet', parentId: 'source', getValue: (_s, _qr, src) => sourceLabel(src.tenantStyle) },
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
  private sources: ConfigSources | undefined;

  constructor(private readonly settingsService: ForgeToolsSettingsService) {
    const refresh = () => {
      this.settings = undefined;
      this.quickRunSettings = undefined;
      this.sources = undefined;
      this._onDidChangeTreeData.fire(undefined);
    };
    settingsService.onDidChangeSettings(refresh);
    // Quick Run settings used to fire nothing, so every caller reset this
    // provider's caches by hand. They now have their own event.
    settingsService.onDidChangeQuickRunSettings(refresh);
    settingsService.onDidChangeEnvironments(refresh);
  }

  async getTreeItem(element: SettingNodeId): Promise<vscode.TreeItem> {
    const node = SETTING_NODES.find((n) => n.id === element);
    if (!node) return new vscode.TreeItem('Unknown');
    const isParent = SETTING_NODES.some((n) => n.parentId === element);
    const settings = await this.getSettings();
    const qrSettings = await this.getQuickRunSettings();
    const sources = await this.getSources();

    const item = new vscode.TreeItem(
      node.label,
      isParent ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );

    if (!isParent) {
      item.description = node.getValue(settings, qrSettings, sources);
      item.contextValue = 'settingItem';
      item.command = {
        command: 'vnextForge.tools.changeSetting',
        title: 'Change',
        arguments: [element],
      };
      const bucket = SOURCE_NODE_BUCKETS[element];
      if (bucket) {
        // The resolved path is the answer to "why is this header here", so it
        // goes on the tooltip rather than being something to go hunting for.
        const resolved = sources[bucket];
        item.tooltip = resolved.path;
        item.iconPath = new vscode.ThemeIcon(resolved.source === 'workspace' ? 'repo' : 'device-desktop');
      } else {
        item.iconPath = new vscode.ThemeIcon('settings-gear');
      }
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
      } else if (element === 'source') {
        item.iconPath = new vscode.ThemeIcon('repo');
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
          // No manual cache reset — `saveQuickRunSettings` fires
          // `onDidChangeQuickRunSettings`, which this provider subscribes to.
          await this.settingsService.saveQuickRunSettings({ polling: { ...qr.polling, retryCount: Number(input) } });
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
        }
        break;
      }
      case 'quickrun.globalHeaders':
        await this.handleEditGlobalHeaders();
        break;
      case 'source.quickRun':
      case 'source.environments':
      case 'source.tenantStyle': {
        const bucket = SOURCE_NODE_BUCKETS[settingId];
        if (bucket) await this.handleConfigSource(bucket);
        break;
      }
    }
  }

  /**
   * What a Config Source row offers.
   *
   * Not a bare `vscode.open`: until the user changes a setting or shares, the
   * resolved file **does not exist on disk** — that is the state every fresh
   * install is in — and opening it raises a "cannot resolve resource" error
   * that explains nothing. Sharing is the action a local row actually wants,
   * so it is offered first and the file is only opened when there is one.
   */
  private async handleConfigSource(bucket: ShareableConfigBucket): Promise<void> {
    const sources = await this.getSources();
    const resolved = sources[bucket];
    const fileExists = await exists(resolved.path);

    const actions: { label: string; detail?: string; id: 'share' | 'open' }[] = [];
    if (resolved.source === 'local') {
      actions.push({
        label: '$(repo-push) Share config with this workspace…',
        detail: 'Writes it to .vnextstudio/forge-tools/ so your team gets it from the repo',
        id: 'share',
      });
    }
    if (fileExists) {
      actions.push({ label: '$(go-to-file) Open file', detail: resolved.path, id: 'open' });
    }

    if (actions.length === 0) {
      // Workspace-sourced but the file vanished under us — a `git checkout`
      // between the read and the click. Say so instead of failing silently.
      void vscode.window.showInformationMessage(`No config file at ${resolved.path}.`);
      return;
    }

    const picked =
      actions.length === 1 ? actions[0] : await vscode.window.showQuickPick(actions, { title: 'Config Source' });
    if (!picked) return;

    if (picked.id === 'share') {
      await vscode.commands.executeCommand('vnextForge.tools.saveConfigToWorkspace');
    } else {
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(resolved.path));
    }
  }

  /**
   * Add / edit / remove Forge-wide Quick Run headers.
   *
   * These headers ride on every Quick Run and Function Run request
   * (`mergeQuickRunHeaders`'s lowest-priority layer) and, until now, could only
   * be set by hand-editing the JSON file — there was no editor anywhere in the
   * product, despite `FunctionRunHeadersTab` telling users to come here.
   */
  private async handleEditGlobalHeaders(): Promise<void> {
    const qr = await this.getQuickRunSettings();
    const headers = [...qr.globalHeaders];

    const picked = await vscode.window.showQuickPick(
      [
        { label: '$(add) Add header…', id: 'add' as const },
        ...headers.map((h) => ({
          label: h.name,
          // A secret's value is never echoed into a QuickPick — that list is
          // rendered over whatever the user is screen-sharing.
          description: h.isSecret ? '••••••' : h.value,
          id: 'edit' as const,
          name: h.name,
        })),
      ],
      { title: 'Quick Run Global Headers', placeHolder: 'Select a header to edit, or add one' },
    );
    if (!picked) return;

    if (picked.id === 'add') {
      const name = await vscode.window.showInputBox({
        title: 'Header name',
        placeHolder: 'Authorization',
        validateInput: (v) =>
          v.trim() === ''
            ? 'Enter a header name'
            : headers.some((h) => h.name === v.trim())
              ? 'That header already exists'
              : undefined,
      });
      if (!name) return;
      const value = await vscode.window.showInputBox({ title: `Value for ${name.trim()}`, password: true });
      if (value == null) return;
      headers.push({ name: name.trim(), value, isSecret: looksSecret(name) });
      await this.saveHeaders(headers);
      return;
    }

    const index = headers.findIndex((h) => h.name === picked.name);
    if (index === -1) return;
    const action = await vscode.window.showQuickPick(
      [
        { label: '$(edit) Change value', id: 'value' as const },
        { label: '$(key) Toggle secret', id: 'secret' as const },
        { label: '$(trash) Remove', id: 'remove' as const },
      ],
      { title: picked.name },
    );
    if (!action) return;

    const existing = headers[index];
    if (!existing) return;

    if (action.id === 'remove') {
      headers.splice(index, 1);
    } else if (action.id === 'secret') {
      headers[index] = { ...existing, isSecret: existing.isSecret !== true };
    } else {
      const value = await vscode.window.showInputBox({
        title: `Value for ${picked.name}`,
        value: existing.value,
        password: existing.isSecret === true,
      });
      if (value == null) return;
      headers[index] = { ...existing, value };
    }
    await this.saveHeaders(headers);
  }

  private async saveHeaders(globalHeaders: QuickRunSettings['globalHeaders']): Promise<void> {
    const sources = await this.getSources();
    // Only warn when the write actually lands in the repository. Editing a
    // machine-local header is nobody else's business.
    if (sources.quickRun.source === 'workspace') {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
      const decision = await confirmWorkspaceHeaderWrite(globalHeaders, workspaceRoot);
      if (decision === 'cancel') return;
      if (decision === 'write-names-only') {
        await this.settingsService.saveQuickRunSettings({
          globalHeaders: stripHeaderValues(globalHeaders),
        });
        return;
      }
    }
    await this.settingsService.saveQuickRunSettings({ globalHeaders });
  }

  private async getSettings(): Promise<ForgeSettings> {
    this.settings ??= await this.settingsService.loadSettings();
    return this.settings;
  }

  private async getSources(): Promise<ConfigSources> {
    this.sources ??= await this.settingsService.resolveSources();
    return this.sources;
  }

  private async getQuickRunSettings(): Promise<QuickRunSettings> {
    this.quickRunSettings ??= await this.settingsService.loadQuickRunSettings();
    return this.quickRunSettings;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
