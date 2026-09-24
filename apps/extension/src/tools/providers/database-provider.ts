import * as vscode from 'vscode';

import {
  buildWfIndexesGenerateArgv,
  parseWfIndexesGenerateOutput,
  scanVnextComponents,
  WF_INDEXES_MIN_VERSION,
  type FileSystemAdapter,
} from '@vnext-forge-studio/services-core';

import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from '../../workspace-detector.js';
import {
  checkIndexSqlSolution,
  databaseNodeIds,
  indexSqlSuccessMessage,
  isIndexSqlBatchInsideRoot,
  listIndexSqlFlows,
  NO_DEFAULT_SOLUTION_MESSAGE,
  nonDefaultSolutionWarning,
  resolveIndexSqlBatch,
  RETIRE_OBSOLETE_WARNING,
  type DatabaseNodeId,
  type IndexSqlSolution,
} from '../index-sql/index-sql-plan.js';
import { pickWorkspaceRoot } from '../pick-workspace-root.js';
import { runWfCaptured, type WfCapturedResult } from '../wf-captured-run.js';
import { WF_CLI_FEATURES, wfCliUpgradeMessage } from '../wf-cli-features.js';
import type { WfCliProbe } from '../wf-cli-probe.js';
import type { WfCliUpgradeNotice } from '../wf-cli-upgrade-notice.js';

const INDEX_SQL_TIMEOUT_MS = 5 * 60_000;
const OPEN_README = 'Open README.txt';
const SHOW_OUTPUT = 'Show Output';
const RETIRE_CONFIRM = 'Retire Obsolete Projections';

export interface DatabaseProviderDeps {
  detector: VnextWorkspaceDetector;
  fs: FileSystemAdapter;
  wfCli: WfCliProbe;
  upgradeNotice: WfCliUpgradeNotice;
  output: vscode.OutputChannel;
  installWfCli: () => Promise<void>;
  runWf?: (argv: readonly string[], opts: { cwd: string; timeoutMs: number }) => Promise<WfCapturedResult>;
}

/**
 * Forge Tools "Database" view: offline attribute-index SQL through
 * `wf indexes generate` (Workflow CLI ≥ 1.1.0). Decisions live in
 * `index-sql-plan.ts`; this class only renders nodes and drives the prompts.
 */
export class DatabaseProvider implements vscode.TreeDataProvider<DatabaseNodeId>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<DatabaseNodeId | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private readonly probeSubscription: { dispose(): void };
  private running = false;

  constructor(private readonly deps: DatabaseProviderDeps) {
    this.probeSubscription = deps.wfCli.onDidInvalidate(() => this._onDidChangeTreeData.fire(undefined));
  }

  dispose(): void {
    this.probeSubscription.dispose();
    this._onDidChangeTreeData.dispose();
  }

  async getTreeItem(element: DatabaseNodeId): Promise<vscode.TreeItem> {
    switch (element) {
      case 'generateIndexSqlAll':
        return this.item('Generate Index SQL (all flows)', 'wf indexes generate', 'database', 'vnextForge.tools.generateIndexSqlAll');
      case 'generateIndexSqlForFlow':
        return this.item('Generate Index SQL for flow…', 'wf indexes generate --flow', 'filter', 'vnextForge.tools.generateIndexSqlForFlow');
      case 'installWfCli':
        return this.item('Install Workflow CLI', 'npm install -g @burgan-tech/vnext-workflow-cli', 'desktop-download', 'vnextForge.tools.installWfCli');
      case 'updateWfCli': {
        const info = await this.deps.wfCli.get();
        const item = this.item(
          'Update Workflow CLI',
          `requires ${WF_INDEXES_MIN_VERSION}+ (installed ${info.version ?? 'unknown'})`,
          'arrow-circle-up',
          'vnextForge.tools.installWfCli',
        );
        // Controller ruling F2: spell out that the required version must be a
        // published release, not just a version string comparison detail.
        item.tooltip = `${wfCliUpgradeMessage(info.version, WF_CLI_FEATURES.indexes)} (requires a published ${WF_INDEXES_MIN_VERSION})`;
        return item;
      }
    }
  }

  async getChildren(element?: DatabaseNodeId): Promise<DatabaseNodeId[]> {
    if (element) return [];
    return databaseNodeIds(await this.deps.wfCli.get());
  }

  async generateIndexSql(scope: 'all' | 'flow'): Promise<void> {
    const info = await this.deps.wfCli.get();
    if (!info.installed) {
      const action = await vscode.window.showWarningMessage(
        'vnext-forge-studio: Workflow CLI (wf) is not installed.',
        'Install Now',
      );
      if (action === 'Install Now') await this.deps.installWfCli();
      return;
    }
    if (!info.supportsIndexes) {
      await this.deps.upgradeNotice.show(info, WF_CLI_FEATURES.indexes);
      return;
    }

    const roots = this.deps.detector.getRoots();
    if (roots.length === 0) {
      void vscode.window.showWarningMessage('vnext-forge-studio: No vnext workspace found.');
      return;
    }
    const root = await pickWorkspaceRoot(roots, {
      title: 'Generate Index SQL: select vNext workspace',
      placeHolder: 'Several vNext roots are open — pick the one to generate index SQL for.',
    });
    if (!root) return;

    const solution = await this.resolveSolution(root);
    if (!solution) return;

    let flow: string | undefined;
    if (scope === 'flow') {
      flow = await this.pickFlow(root, solution);
      if (!flow) return;
    }

    const retireObsolete = await this.pickRetireObsolete();
    if (retireObsolete === undefined) return;

    const argv = buildWfIndexesGenerateArgv({
      base: 'indexes generate',
      ...(flow ? { flow } : {}),
      retireObsolete,
    });
    await this.run(argv, root.folderPath);
  }

  private item(label: string, description: string, icon: string, command: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = description;
    item.iconPath = new vscode.ThemeIcon(icon);
    item.command = { command, title: label };
    return item;
  }

  private async resolveSolution(root: VnextWorkspaceRoot): Promise<IndexSqlSolution | undefined> {
    let check = checkIndexSqlSolution(root.solutions);
    if (check.kind === 'pickSolution') {
      const picked = await vscode.window.showQuickPick(
        check.solutions.map((solution) => ({
          label: solution.config.domain,
          description: solution.fileName,
          ...(solution.isDefault ? { detail: 'Default solution — the one the Workflow CLI processes' } : {}),
          fileName: solution.fileName,
        })),
        {
          title: 'Generate Index SQL: select solution',
          placeHolder: 'This workspace holds several solution files.',
          ignoreFocusOut: true,
        },
      );
      if (!picked) return undefined;
      check = checkIndexSqlSolution(root.solutions, picked.fileName);
    }
    switch (check.kind) {
      case 'ready':
        return check.solution;
      case 'noDefault':
        void vscode.window.showErrorMessage(`vnext-forge-studio: ${NO_DEFAULT_SOLUTION_MESSAGE}`);
        return undefined;
      case 'nonDefault': {
        const useDefault = `Use ${check.fallback.config.domain}`;
        const action = await vscode.window.showWarningMessage(
          // Controller ruling F3: prefix the modal warning.
          `vnext-forge-studio: ${nonDefaultSolutionWarning(check.chosen, check.fallback)}`,
          { modal: true },
          useDefault,
        );
        return action === useDefault ? check.fallback : undefined;
      }
      case 'pickSolution':
        // Not returned once a file name was chosen.
        return undefined;
    }
  }

  private async pickFlow(root: VnextWorkspaceRoot, solution: IndexSqlSolution): Promise<string | undefined> {
    const { components } = await scanVnextComponents(this.deps.fs, root.folderPath, solution.config.paths, {
      onlyCategory: 'workflows',
    });
    const flows = listIndexSqlFlows(components.workflows, solution.config.domain);
    if (flows.length === 0) {
      void vscode.window.showWarningMessage(
        `vnext-forge-studio: No local workflows of domain "${solution.config.domain}" were found.`,
      );
      return undefined;
    }
    const picked = await vscode.window.showQuickPick(
      flows.map((flow) => ({
        label: flow.key,
        description: vscode.workspace.asRelativePath(flow.path, false),
        key: flow.key,
      })),
      {
        title: 'Generate Index SQL: select workflow',
        placeHolder: 'Only workflows whose schema is a master schema produce SQL.',
        matchOnDescription: true,
        ignoreFocusOut: true,
      },
    );
    return picked?.key;
  }

  /** `false` = keep obsolete projections, `true` = retire (confirmed), `undefined` = cancelled. */
  private async pickRetireObsolete(): Promise<boolean | undefined> {
    const picked = await vscode.window.showQuickPick(
      [
        { label: 'Keep obsolete projections', description: 'default', retire: false },
        { label: 'Retire obsolete projections…', description: '--retire-obsolete', retire: true },
      ],
      { title: 'Generate Index SQL: obsolete projections', ignoreFocusOut: true },
    );
    if (!picked) return undefined;
    if (!picked.retire) return false;
    const action = await vscode.window.showWarningMessage(
      // Controller ruling F3: prefix the modal warning.
      `vnext-forge-studio: ${RETIRE_OBSOLETE_WARNING}`,
      { modal: true },
      RETIRE_CONFIRM,
    );
    return action === RETIRE_CONFIRM ? true : undefined;
  }

  private async run(argv: readonly string[], cwd: string): Promise<void> {
    if (this.running) {
      void vscode.window.showInformationMessage('vnext-forge-studio: Index SQL generation is already running.');
      return;
    }
    const result = await this.execute(argv, cwd);
    if (result.stdout) this.deps.output.append(result.stdout);
    if (result.stderr) this.deps.output.append(result.stderr);

    const outcome = parseWfIndexesGenerateOutput(result.stdout, result.stderr);
    if (result.exitCode !== 0 || outcome.kind !== 'generated') {
      const message =
        result.errorMessage ?? (outcome.kind === 'failed' ? outcome.message : 'The Workflow CLI reported an error.');
      const action = await vscode.window.showErrorMessage(
        `vnext-forge-studio: Index SQL generation failed: ${message}`,
        SHOW_OUTPUT,
      );
      if (action === SHOW_OUTPUT) this.deps.output.show(true);
      return;
    }

    const { batchDir, readmePath } = resolveIndexSqlBatch(cwd, outcome.batchPath);
    // Hardening (Task 7 review): only offer to reveal/open the batch when it
    // resolved inside the workspace root — the CLI's `-o` output folder is not
    // itself restricted to the workspace.
    const insideRoot = isIndexSqlBatchInsideRoot(cwd, batchDir);
    if (insideRoot) {
      await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(batchDir));
    }
    const successMessage = `vnext-forge-studio: ${indexSqlSuccessMessage(outcome.count, batchDir, cwd)}`;
    const action = insideRoot
      ? await vscode.window.showInformationMessage(successMessage, OPEN_README)
      : await vscode.window.showInformationMessage(successMessage);
    if (insideRoot && action === OPEN_README) {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(readmePath));
      await vscode.window.showTextDocument(document, { preview: false });
    }
  }

  /** The CLI run itself; `running` covers only this span, not the follow-up notifications. */
  private async execute(argv: readonly string[], cwd: string): Promise<WfCapturedResult> {
    const runWf = this.deps.runWf ?? runWfCaptured;
    this.running = true;
    try {
      this.deps.output.appendLine(`[index-sql] ${cwd} $ wf ${argv.join(' ')}`);
      return await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating index SQL…' },
        () => runWf(argv, { cwd, timeoutMs: INDEX_SQL_TIMEOUT_MS }),
      );
    } finally {
      this.running = false;
    }
  }
}
