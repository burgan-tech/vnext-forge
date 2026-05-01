import * as vscode from 'vscode';
import type { VnextWorkspaceDetector } from '../../workspace-detector.js';
import type { ForgeTerminalManager } from '../forge-terminal.js';

type ProjectActionId = 'validate' | 'buildRuntime' | 'buildReference';

interface ProjectAction {
  id: ProjectActionId;
  label: string;
  description: string;
  icon: string;
  contextValue: string;
}

const PROJECT_ACTIONS: ProjectAction[] = [
  {
    id: 'validate',
    label: 'Validate Project',
    description: 'npm run validate',
    icon: 'check-all',
    contextValue: 'projectAction_validate',
  },
  {
    id: 'buildRuntime',
    label: 'Build Runtime',
    description: 'npm run build:runtime',
    icon: 'package',
    contextValue: 'projectAction_buildRuntime',
  },
  {
    id: 'buildReference',
    label: 'Build Reference',
    description: 'npm run build:reference',
    icon: 'references',
    contextValue: 'projectAction_buildReference',
  },
];

const TERMINAL_COMMANDS: Record<ProjectActionId, string> = {
  validate: 'npm run validate',
  buildRuntime: 'npm run build:runtime',
  buildReference: 'npm run build:reference',
};

export class ProjectActionsProvider implements vscode.TreeDataProvider<ProjectActionId> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ProjectActionId | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly detector: VnextWorkspaceDetector,
    private readonly terminal: ForgeTerminalManager,
  ) {}

  getTreeItem(element: ProjectActionId): vscode.TreeItem {
    const action = PROJECT_ACTIONS.find((a) => a.id === element)!;
    const item = new vscode.TreeItem(action.label, vscode.TreeItemCollapsibleState.None);
    item.description = action.description;
    item.iconPath = new vscode.ThemeIcon(action.icon);
    item.contextValue = action.contextValue;
    item.command = {
      command: `vnextForge.tools.${action.id === 'validate' ? 'validateProject' : action.id === 'buildRuntime' ? 'buildRuntime' : 'buildReference'}`,
      title: action.label,
    };
    return item;
  }

  getChildren(element?: ProjectActionId): ProjectActionId[] {
    if (element) return [];
    return PROJECT_ACTIONS.map((a) => a.id);
  }

  runAction(actionId: ProjectActionId): void {
    const roots = this.detector.getRoots();
    if (roots.length === 0) {
      void vscode.window.showWarningMessage('vnext-forge: No vnext workspace found.');
      return;
    }

    const cwd = roots[0].folderPath;
    const command = TERMINAL_COMMANDS[actionId];
    this.terminal.run(command, { cwd });
  }
}
