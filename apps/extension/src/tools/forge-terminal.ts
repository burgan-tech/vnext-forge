import * as vscode from 'vscode';

const TERMINAL_NAME = 'vnext-forge';

/**
 * Manages a pool of VS Code terminals under the "vnext-forge" name.
 * Reuses an existing idle terminal when possible; creates a new one
 * only when every managed terminal is either busy or closed.
 *
 * "Busy" is tracked via {@link vscode.window.onDidEndTerminalShellExecution}
 * (VS Code 1.93+). When shell integration is unavailable the terminal is
 * optimistically considered idle after the first command is sent.
 */
export class ForgeTerminalManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly busyTerminals = new Set<vscode.Terminal>();

  constructor() {
    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        this.busyTerminals.delete(terminal);
      }),
    );

    if (vscode.window.onDidEndTerminalShellExecution) {
      this.disposables.push(
        vscode.window.onDidEndTerminalShellExecution((event) => {
          this.busyTerminals.delete(event.terminal);
        }),
      );
    }
  }

  /**
   * Run a shell command string in a managed terminal.
   *
   * @param command  The shell command to execute.
   * @param options  Optional overrides (working directory, whether to reveal).
   */
  run(command: string, options?: { cwd?: string; show?: boolean }): void {
    const terminal = this.acquireTerminal(options?.cwd);
    if (options?.show !== false) {
      terminal.show(true);
    }
    terminal.sendText(command);
    this.busyTerminals.add(terminal);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.busyTerminals.clear();
  }

  private acquireTerminal(cwd?: string): vscode.Terminal {
    const allTerminals = vscode.window.terminals.filter(
      (t) => t.name === TERMINAL_NAME && t.exitStatus === undefined,
    );

    const idle = allTerminals.find((t) => !this.busyTerminals.has(t));
    if (idle) return idle;

    return vscode.window.createTerminal({ name: TERMINAL_NAME, cwd });
  }
}
