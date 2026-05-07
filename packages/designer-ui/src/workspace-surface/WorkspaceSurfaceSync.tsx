import { useEffect, useRef } from 'react';

import { useRuntimeStore } from '../store/useRuntimeStore.js';
import { useValidationStore } from '../store/useValidationStore.js';
import type { WorkspaceDiagnosticDto, WorkspaceStatusDto } from './workspace-surface-port.js';
import { pushDiagnosticsToHost, pushStatusToHost } from './workspace-surface-port.js';

const DEBOUNCE_MS = 200;

/**
 * Reactive bridge that subscribes to validation and runtime stores and pushes
 * snapshots to the registered workspace surface sink whenever state changes.
 *
 * Mount this component once at the shell root (both web and extension webview).
 * In the web shell the sink is a no-op; in the extension webview the sink
 * forwards to the extension host via postMessage.
 *
 * Renders `null` — side-effect only.
 */
export function WorkspaceSurfaceSync() {
  useDiagnosticsSync();
  useStatusSync();
  return null;
}

function useDiagnosticsSync() {
  const issues = useValidationStore((s) => s.issues);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      const diagnostics: WorkspaceDiagnosticDto[] = issues.map((issue) => ({
        filePath: issue.path ?? '',
        severity: issue.severity,
        message: issue.message,
        source: 'vnext-forge-studio',
        range: undefined,
      }));
      pushDiagnosticsToHost(diagnostics);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [issues]);
}

function useStatusSync() {
  const connected = useRuntimeStore((s) => s.connected);
  const healthStatus = useRuntimeStore((s) => s.healthStatus);
  const issues = useValidationStore((s) => s.issues);

  useEffect(() => {
    const runtimeLabel = connected
      ? 'Runtime Connected'
      : healthStatus === 'unhealthy'
        ? 'Runtime Offline'
        : 'Standalone Mode';

    const validationErrorCount = issues.filter((i) => i.severity === 'error').length;
    const validationWarningCount = issues.filter((i) => i.severity === 'warning').length;

    const status: WorkspaceStatusDto = {
      runtimeConnected: connected,
      runtimeLabel,
      validationErrorCount,
      validationWarningCount,
    };

    pushStatusToHost(status);
  }, [connected, healthStatus, issues]);
}
