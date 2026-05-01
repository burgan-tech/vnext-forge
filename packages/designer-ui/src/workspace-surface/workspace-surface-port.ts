/**
 * Host-agnostic workspace surface port.
 *
 * `designer-ui` modules push diagnostics and status snapshots through this
 * port without knowing how the host surfaces them. The web shell registers a
 * no-op sink (it has its own StatusBar component). The VS Code extension
 * webview registers a sink that forwards data to the extension host via
 * postMessage so it can drive the native Problems panel and Status Bar item.
 *
 * Until a sink is registered, calls are silently dropped.
 */

export interface WorkspaceDiagnosticDto {
  /** Workspace-relative file path (forward slashes). */
  filePath: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** Source identifier shown in the Problems panel (e.g. 'vnext-forge'). */
  source: string;
  range?: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
}

export interface WorkspaceStatusDto {
  runtimeConnected: boolean;
  runtimeLabel: string;
  validationErrorCount: number;
  validationWarningCount: number;
}

export interface WorkspaceSurfaceSink {
  pushDiagnostics(diagnostics: WorkspaceDiagnosticDto[]): void;
  pushStatus(status: WorkspaceStatusDto): void;
}

const NOOP_SINK: WorkspaceSurfaceSink = {
  pushDiagnostics: () => undefined,
  pushStatus: () => undefined,
};

let activeSink: WorkspaceSurfaceSink = NOOP_SINK;

/**
 * Register the active workspace surface sink. Called once during shell
 * bootstrap. Subsequent registrations replace the previous sink.
 */
export function registerWorkspaceSurfaceSink(sink: WorkspaceSurfaceSink): void {
  activeSink = sink;
}

/**
 * Reset the sink back to a no-op. Primarily intended for tests / teardown.
 */
export function resetWorkspaceSurfaceSink(): void {
  activeSink = NOOP_SINK;
}

/**
 * Push a full diagnostics snapshot to the host. The host replaces its entire
 * diagnostic set with this payload (full-replace semantics, not delta).
 */
export function pushDiagnosticsToHost(diagnostics: WorkspaceDiagnosticDto[]): void {
  activeSink.pushDiagnostics(diagnostics);
}

/**
 * Push the current workspace status snapshot to the host.
 */
export function pushStatusToHost(status: WorkspaceStatusDto): void {
  activeSink.pushStatus(status);
}
