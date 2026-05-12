import { useEffect, useRef } from 'react';

import { useComponentStore } from '../store/useComponentStore.js';
import { useProjectStore } from '../store/useProjectStore.js';
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

function toWorkspaceRelativePath(absolutePath: string, projectRoot: string): string {
  if (!projectRoot || !absolutePath) return absolutePath;
  const normAbs = absolutePath.replace(/\\/g, '/');
  const normRoot = projectRoot.replace(/\\/g, '/').replace(/\/$/, '');
  if (normAbs.startsWith(normRoot + '/')) {
    return normAbs.slice(normRoot.length + 1);
  }
  return absolutePath;
}

function useDiagnosticsSync() {
  const issues = useValidationStore((s) => s.issues);
  const componentErrors = useComponentStore((s) => s.validationErrors);
  const componentFilePath = useComponentStore((s) => s.filePath);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      const workflowDiagnostics: WorkspaceDiagnosticDto[] = issues.map((issue) => ({
        filePath: issue.path ?? '',
        severity: issue.severity,
        message: issue.message,
        source: 'vnext-forge-studio',
        range: undefined,
      }));

      const componentDiagnostics: WorkspaceDiagnosticDto[] =
        componentErrors.length > 0 && componentFilePath
          ? componentErrors.map((err) => {
              const projectPath = useProjectStore.getState().activeProject?.path ?? '';
              return {
                filePath: toWorkspaceRelativePath(componentFilePath, projectPath),
                severity: 'error' as const,
                message: err.path ? `${err.path}: ${err.message}` : err.message,
                source: 'vnext-forge-studio',
                range: undefined,
              };
            })
          : [];

      pushDiagnosticsToHost([...workflowDiagnostics, ...componentDiagnostics]);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [issues, componentErrors, componentFilePath]);
}

function useStatusSync() {
  const connected = useRuntimeStore((s) => s.connected);
  const healthStatus = useRuntimeStore((s) => s.healthStatus);
  const issues = useValidationStore((s) => s.issues);
  const componentErrorCount = useComponentStore((s) => s.validationErrors.length);

  useEffect(() => {
    const runtimeLabel = connected
      ? 'Runtime Connected'
      : healthStatus === 'unhealthy'
        ? 'Runtime Offline'
        : 'Standalone Mode';

    const validationErrorCount = issues.filter((i) => i.severity === 'error').length + componentErrorCount;
    const validationWarningCount = issues.filter((i) => i.severity === 'warning').length;

    const status: WorkspaceStatusDto = {
      runtimeConnected: connected,
      runtimeLabel,
      validationErrorCount,
      validationWarningCount,
    };

    pushStatusToHost(status);
  }, [connected, healthStatus, issues, componentErrorCount]);
}
