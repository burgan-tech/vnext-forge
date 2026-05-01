import type {
  WorkspaceDiagnosticDto,
  WorkspaceStatusDto,
  WorkspaceSurfaceSink,
} from '@vnext-forge/designer-ui';

import type { VsCodeWebviewApi } from '../VsCodeTransport';

export interface HostDiagnosticsFrame {
  type: 'host:diagnostics';
  diagnostics: WorkspaceDiagnosticDto[];
}

export interface HostStatusFrame {
  type: 'host:status';
  status: WorkspaceStatusDto;
}

/**
 * Build a {@link WorkspaceSurfaceSink} that forwards diagnostics and status
 * snapshots to the VS Code extension host via `postMessage`. The host maps
 * these to native DiagnosticCollection and StatusBarItem updates.
 */
export function createVsCodeWorkspaceSurfaceSink(api: VsCodeWebviewApi): WorkspaceSurfaceSink {
  return {
    pushDiagnostics(diagnostics) {
      const frame: HostDiagnosticsFrame = {
        type: 'host:diagnostics',
        diagnostics,
      };
      api.postMessage(frame);
    },
    pushStatus(status) {
      const frame: HostStatusFrame = {
        type: 'host:status',
        status,
      };
      api.postMessage(frame);
    },
  };
}
