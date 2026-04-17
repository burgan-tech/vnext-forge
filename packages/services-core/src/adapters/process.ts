/**
 * Adapter for spawning external processes (e.g. running the
 * `@burgan-tech/vnext-template/init.js` scaffolder).
 *
 * Both shells inject a Node `child_process` based implementation today; the
 * indirection exists so tests can fake the process and so an extension shell
 * could route through `vscode.window.createTerminal` if needed.
 */
export interface ProcessAdapter {
  /**
   * Run `nodeBinaryArgs` on the current Node executable. Returns combined
   * stdout. Throws an `Error` (NOT `VnextForgeError`) on non-zero exit so the
   * calling service can map the failure with proper context.
   */
  runNode(args: {
    scriptPath: string
    scriptArgs: string[]
    cwd: string
    timeoutMs?: number
    env?: Record<string, string | undefined>
  }): Promise<{ stdout: string; stderr: string }>
}
