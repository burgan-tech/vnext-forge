import * as vscode from 'vscode';

type QuickRunItemId = 'openQuickRun';

interface QuickRunItem {
  id: QuickRunItemId;
  label: string;
  description: string;
  icon: string;
}

const QUICKRUN_ITEMS: QuickRunItem[] = [
  {
    id: 'openQuickRun',
    label: 'Open Quick Run',
    description: 'Simulate and debug workflows',
    icon: 'play',
  },
];

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
      command: 'vnextForge.openQuickRun',
      title: entry.label,
    };
    return item;
  }

  getChildren(element?: QuickRunItemId): QuickRunItemId[] {
    if (element) return [];
    return QUICKRUN_ITEMS.map((i) => i.id);
  }
}
