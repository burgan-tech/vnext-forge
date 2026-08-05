import * as vscode from 'vscode';

type QuickRunItemId = 'openQuickRun' | 'openFunctionQuickRun';

interface QuickRunItem {
  id: QuickRunItemId;
  label: string;
  description: string;
  icon: string;
  command: string;
}

const QUICKRUN_ITEMS: QuickRunItem[] = [
  {
    id: 'openQuickRun',
    label: 'Open Quick Run',
    description: 'Simulate and debug workflows',
    icon: 'play',
    command: 'vnextForge.openQuickRun',
  },
  {
    id: 'openFunctionQuickRun',
    label: 'Open Function Quick Run',
    description: 'Invoke a vNext function',
    icon: 'zap',
    command: 'vnextForge.openFunctionQuickRun',
  },
];

/**
 * Backs the "Quick Run" Forge Tools tree section. Holds both the workflow
 * runner and the function runner entries — a second `TreeDataProvider` per
 * runner would just duplicate this same handful of lines for no reader
 * benefit, since both entries live under the identical
 * `vnextForge.tools.quickRun` view and `vnextForge.isVnextWorkspace` gate.
 */
export class QuickRunProvider implements vscode.TreeDataProvider<QuickRunItemId> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<QuickRunItemId | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: QuickRunItemId): vscode.TreeItem {
    const entry = QUICKRUN_ITEMS.find((i) => i.id === element)!;
    const item = new vscode.TreeItem(entry.label, vscode.TreeItemCollapsibleState.None);
    item.description = entry.description;
    item.iconPath = new vscode.ThemeIcon(entry.icon);
    item.contextValue = 'quickRunAction';
    item.command = {
      command: entry.command,
      title: entry.label,
    };
    return item;
  }

  getChildren(element?: QuickRunItemId): QuickRunItemId[] {
    if (element) return [];
    return QUICKRUN_ITEMS.map((i) => i.id);
  }
}
