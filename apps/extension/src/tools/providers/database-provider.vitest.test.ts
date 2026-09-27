import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ServicesCore from '@vnext-forge-studio/services-core';
import type { VnextSolutionFile } from '@vnext-forge-studio/services-core';

import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from '../../workspace-detector.js';
import type { WfCapturedResult } from '../wf-captured-run.js';
import type { WfCliInfo } from '../wf-cli-probe.js';
import type { WfCliUpgradeNotice } from '../wf-cli-upgrade-notice.js';
import type { OutputChannel } from 'vscode';

/**
 * Only `scanVnextComponents` (disk scan) is stubbed — everything else
 * (`isValidWfFlowKey`, `buildWfIndexesGenerateArgv`, …) stays real so
 * `index-sql-plan.ts` and `database-provider.ts` behave exactly as in
 * production for the "for flow…" scope test below.
 */
vi.mock('@vnext-forge-studio/services-core', async (importOriginal) => {
  const actual = await importOriginal<typeof ServicesCore>();
  return { ...actual, scanVnextComponents: vi.fn() };
});

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
const { scanVnextComponents } = (await import('@vnext-forge-studio/services-core')) as unknown as {
  scanVnextComponents: ReturnType<typeof vi.fn>;
};
const vscode = (await import('vscode')) as unknown as {
  window: {
    showQuickPick: ReturnType<typeof vi.fn>;
    showErrorMessage: ReturnType<typeof vi.fn>;
    showWarningMessage: ReturnType<typeof vi.fn>;
    showInformationMessage: ReturnType<typeof vi.fn>;
  };
  commands: {
    executeCommand: ReturnType<typeof vi.fn>;
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

function nonDefaultSolution(domain: string, fileName: string): VnextSolutionFile {
  const config = { domain, paths: { componentsRoot: domain } } as unknown as NonNullable<VnextSolutionFile['config']>;
  return {
    fileName,
    filePath: `/ws/${fileName}`,
    rootPath: '/ws',
    isDefault: false,
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

function fakeMultiSolutionRoot(): VnextWorkspaceRoot {
  return {
    folderUri: { fsPath: '/ws' } as never,
    folderPath: '/ws',
    configPath: '/ws/vnext.config.json',
    solutions: [defaultSolution('core'), nonDefaultSolution('other', 'vnext.other.config.json')],
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

function makeProvider(
  runWf: (argv: readonly string[], opts: { cwd: string; timeoutMs: number }) => Promise<WfCapturedResult>,
  roots: VnextWorkspaceRoot[] = [fakeRoot()],
) {
  const detector = { getRoots: () => roots } as unknown as VnextWorkspaceDetector;
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

describe('DatabaseProvider generateIndexSql prompts and success message', () => {
  beforeEach(() => {
    vscode.window.showQuickPick.mockReset();
    vscode.window.showWarningMessage.mockReset();
    vscode.window.showErrorMessage.mockReset();
    vscode.window.showInformationMessage.mockReset();
    vscode.commands.executeCommand.mockReset();
    scanVnextComponents.mockReset();
  });

  it('retire-obsolete: cancelling the confirm modal never spawns wf', async () => {
    // Quick pick chooses "Retire obsolete projections…", then the modal
    // warning is dismissed (Escape / click outside → `undefined`).
    vscode.window.showQuickPick.mockResolvedValueOnce({ label: 'Retire obsolete projections…', retire: true });
    vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
    const runWf = vi.fn<(argv: readonly string[], opts: { cwd: string; timeoutMs: number }) => Promise<WfCapturedResult>>();
    const provider = makeProvider(runWf);

    await provider.generateIndexSql('all');

    expect(runWf).not.toHaveBeenCalled();
  });

  it('multi-domain: declining the non-default-solution modal never spawns wf', async () => {
    // Two solutions in the root → the solution QuickPick appears; the user
    // picks the non-default one, then declines the "use default instead?"
    // modal warning.
    vscode.window.showQuickPick.mockResolvedValueOnce({
      label: 'other',
      fileName: 'vnext.other.config.json',
    });
    vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
    const runWf = vi.fn<(argv: readonly string[], opts: { cwd: string; timeoutMs: number }) => Promise<WfCapturedResult>>();
    const provider = makeProvider(runWf, [fakeMultiSolutionRoot()]);

    await provider.generateIndexSql('all');

    expect(runWf).not.toHaveBeenCalled();
    // Never reached the retire-obsolete prompt.
    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
  });

  it('success path: offers Reveal/README when the batch resolves inside the workspace root', async () => {
    vscode.window.showQuickPick.mockResolvedValueOnce({ label: 'Keep obsolete projections', retire: false });
    const runWf = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: '  ✓ Generated 2 SQL file(s): /ws/index-sql/batch-1\n',
      stderr: '',
    } satisfies WfCapturedResult);
    const provider = makeProvider(runWf);

    await provider.generateIndexSql('all');

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'revealInExplorer',
      expect.objectContaining({ fsPath: '/ws/index-sql/batch-1' }),
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Generated 2 SQL file(s) in index-sql/batch-1'),
      'Open README.txt',
    );
  });

  it('success path: does not offer Reveal/README when the batch resolves outside the workspace root', async () => {
    vscode.window.showQuickPick.mockResolvedValueOnce({ label: 'Keep obsolete projections', retire: false });
    const runWf = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: '  ✓ Generated 2 SQL file(s): /outside/index-sql/batch-1\n',
      stderr: '',
    } satisfies WfCapturedResult);
    const provider = makeProvider(runWf);

    await provider.generateIndexSql('all');

    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Generated 2 SQL file(s) in /outside/index-sql/batch-1'),
    );
    // Called with the message only — no README button offered.
    const call = vscode.window.showInformationMessage.mock.calls.at(-1);
    expect(call).toHaveLength(1);
  });

  it('"for flow…" scope: argv carries --flow and never --domain', async () => {
    scanVnextComponents.mockResolvedValue({
      components: {
        workflows: [{ key: 'money-transfer', path: '/ws/core/Workflows/money-transfer.json', flow: 'sys-flows', domain: 'core' }],
        tasks: [],
        schemas: [],
        views: [],
        functions: [],
        extensions: [],
        mappings: [],
      },
    });
    vscode.window.showQuickPick.mockResolvedValueOnce({ label: 'money-transfer', key: 'money-transfer' });
    vscode.window.showQuickPick.mockResolvedValueOnce({ label: 'Keep obsolete projections', retire: false });
    const runWf = vi.fn().mockResolvedValue({ exitCode: 0, stdout: '  ✓ Generated 0 SQL file(s): /ws/index-sql/batch-1\n', stderr: '' } satisfies WfCapturedResult);
    const provider = makeProvider(runWf);

    await provider.generateIndexSql('flow');

    expect(runWf).toHaveBeenCalledTimes(1);
    const [argv] = runWf.mock.calls[0] as [readonly string[], unknown];
    expect(argv).toContain('--flow');
    expect(argv).toContain('money-transfer');
    expect(argv).not.toContain('--domain');
  });
});
