import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VnextSolutionFile } from '@vnext-forge-studio/services-core';

import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from '../../workspace-detector.js';
import type { WfCapturedResult } from '../wf-captured-run.js';
import type { WfCliInfo } from '../wf-cli-probe.js';
import type { WfCliUpgradeNotice } from '../wf-cli-upgrade-notice.js';
import type { OutputChannel } from 'vscode';

/**
 * Minimal `vscode` stand-in for `DatabaseProvider`. Only the surface the
 * provider actually touches (`window.show*Message`, `window.showQuickPick`,
 * `window.withProgress`, `commands.executeCommand`, `workspace.*`, `Uri.file`,
 * `EventEmitter`, `TreeItem`/`ThemeIcon`) — this file is the one exception to
 * the repo-wide "no `vscode` import in a `.vitest.test.ts`" convention
 * (see `vitest.config.ts`), scoped to pin the failure-message selection this
 * fix round is about.
 */
vi.mock('vscode', () => {
  class EventEmitter<T> {
    private readonly listeners = new Set<(e: T) => void>();
    readonly event = (listener: (e: T) => void) => {
      this.listeners.add(listener);
      return { dispose: () => this.listeners.delete(listener) };
    };
    fire(e: T): void {
      for (const listener of [...this.listeners]) listener(e);
    }
    dispose(): void {
      this.listeners.clear();
    }
  }
  class TreeItem {
    description?: string;
    iconPath?: unknown;
    tooltip?: string;
    command?: unknown;
    constructor(
      public label: string,
      public collapsibleState?: number,
    ) {}
  }
  class ThemeIcon {
    constructor(public id: string) {}
  }
  const Uri = { file: (path: string) => ({ fsPath: path, path }) };
  return {
    EventEmitter,
    TreeItem,
    ThemeIcon,
    Uri,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ProgressLocation: { Notification: 15 },
    window: {
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showQuickPick: vi.fn(),
      showTextDocument: vi.fn(),
      withProgress: (_opts: unknown, task: () => unknown) => task(),
    },
    workspace: {
      openTextDocument: vi.fn(),
      asRelativePath: (path: string) => path,
    },
    commands: {
      executeCommand: vi.fn(),
    },
  };
});

const { DatabaseProvider } = await import('./database-provider.js');
const vscode = (await import('vscode')) as unknown as {
  window: {
    showQuickPick: ReturnType<typeof vi.fn>;
    showErrorMessage: ReturnType<typeof vi.fn>;
    showWarningMessage: ReturnType<typeof vi.fn>;
    showInformationMessage: ReturnType<typeof vi.fn>;
  };
};

function defaultSolution(domain: string): VnextSolutionFile {
  const config = { domain, paths: { componentsRoot: domain } } as unknown as NonNullable<VnextSolutionFile['config']>;
  return {
    fileName: 'vnext.config.json',
    filePath: '/ws/vnext.config.json',
    rootPath: '/ws',
    isDefault: true,
    status: { status: 'ok', config },
    config,
  };
}

function fakeRoot(): VnextWorkspaceRoot {
  return {
    folderUri: { fsPath: '/ws' } as never,
    folderPath: '/ws',
    configPath: '/ws/vnext.config.json',
    solutions: [defaultSolution('core')],
    issues: [],
  };
}

const cliInfo: WfCliInfo = {
  installed: true,
  version: '1.1.0',
  supportsDomainFlag: true,
  supportsIndexes: true,
  supportsPublishCompleted: true,
};

function makeProvider(runWf: (argv: readonly string[], opts: { cwd: string; timeoutMs: number }) => Promise<WfCapturedResult>) {
  const detector = { getRoots: () => [fakeRoot()] } as unknown as VnextWorkspaceDetector;
  const wfCli = {
    get: () => Promise.resolve(cliInfo),
    onDidInvalidate: () => ({ dispose: () => undefined }),
    invalidate: () => undefined,
  };
  const upgradeNotice = { show: vi.fn(), maybeShow: vi.fn() } as unknown as WfCliUpgradeNotice;
  const output = { append: vi.fn(), appendLine: vi.fn(), show: vi.fn() } as unknown as OutputChannel;
  return new DatabaseProvider({
    detector,
    fs: {} as never,
    wfCli: wfCli as never,
    upgradeNotice,
    output,
    installWfCli: () => Promise.resolve(),
    runWf,
  });
}

describe('DatabaseProvider failure message selection', () => {
  beforeEach(() => {
    vscode.window.showQuickPick.mockReset();
    vscode.window.showErrorMessage.mockReset();
    // Only the "keep obsolete projections" quick-pick is exercised on the way
    // to `run()`; every scenario below picks it the same way.
    vscode.window.showQuickPick.mockResolvedValue({ label: 'Keep obsolete projections', retire: false });
  });

  it('prefers the parsed CLI message over raw (ANSI) stderr on a normal non-zero exit', async () => {
    const ansiStderr = '\u001b[31m  ✗ No workflows referencing "money-transfer" were found.\u001b[0m\n';
    const provider = makeProvider(() =>
      Promise.resolve({
        exitCode: 1,
        stdout: '',
        stderr: ansiStderr,
        // As `runWfCaptured`'s hardening now fills it on any non-zero exit.
        errorMessage: ansiStderr.trim(),
      }),
    );

    await provider.generateIndexSql('all');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'vnext-forge-studio: Index SQL generation failed: No workflows referencing "money-transfer" were found.',
      'Show Output',
    );
  });

  it('shows the stderr text when the parser found nothing more specific', async () => {
    const stderr = "'wf' is not recognized as an internal or external command.";
    const provider = makeProvider(() =>
      Promise.resolve({ exitCode: 1, stdout: '', stderr, errorMessage: stderr }),
    );

    await provider.generateIndexSql('all');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      `vnext-forge-studio: Index SQL generation failed: ${stderr}`,
      'Show Output',
    );
  });

  it('uses errorMessage on a spawn failure (no exit code)', async () => {
    const provider = makeProvider(() =>
      Promise.resolve({
        exitCode: null,
        stdout: '',
        stderr: '',
        errorMessage: 'The Workflow CLI (wf) was not found on PATH.',
      }),
    );

    await provider.generateIndexSql('all');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'vnext-forge-studio: Index SQL generation failed: The Workflow CLI (wf) was not found on PATH.',
      'Show Output',
    );
  });
});
