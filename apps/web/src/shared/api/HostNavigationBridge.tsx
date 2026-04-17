import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProjectStore } from '@app/store/useProjectStore';
import type { VnextWorkspaceConfig } from '@modules/project-management/ProjectTypes';
import { createLogger } from '@shared/lib/logger/createLogger';
import { getVsCodeApi } from './vscodeTransport';

const logger = createLogger('HostNavigationBridge');

// Types mirrored from apps/extension/src/file-router.ts
interface HostFileRoute {
  type: 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension' | 'config' | 'unknown';
  group: string;
  name: string;
  navigateTo?: string;
  filePath: string;
}

interface HostNavigateMessage {
  type: 'navigate';
  route: HostFileRoute;
  projectId: string;
  projectPath: string;
  projectDomain?: string;
  vnextConfig?: VnextWorkspaceConfig;
}

let readySent = false;
function signalReady() {
  if (readySent) return;
  try {
    getVsCodeApi().postMessage({ type: 'webview-ready' });
    readySent = true;
  } catch (error) {
    logger.warn('Failed to send webview-ready signal', { error: (error as Error).message });
  }
}

function isHostNavigateMessage(value: unknown): value is HostNavigateMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'navigate' &&
    typeof (value as HostNavigateMessage).projectId === 'string' &&
    typeof (value as HostNavigateMessage).projectPath === 'string' &&
    typeof (value as HostNavigateMessage).route === 'object'
  );
}

/**
 * Listens for host-originated navigation messages and drives React Router.
 * Also hydrates the project store with the host-provided projectId/path so the
 * active-project dependent code keeps working without the old ProjectList flow.
 */
export function HostNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    signalReady();

    function onMessage(event: MessageEvent) {
      if (!isHostNavigateMessage(event.data)) return;
      const { route, projectId, projectPath, projectDomain, vnextConfig } = event.data;
      logger.info('Host navigate message received', { type: route.type, projectId, navigateTo: route.navigateTo });

      // Populate the active project AND the vnext config so downstream editors
      // can resolve workspace context without an extra round-trip to the host.
      const { activeProject, setActiveProject, setVnextConfig, refreshFileTree } =
        useProjectStore.getState();
      const changedProject = activeProject?.id !== projectId;
      setActiveProject({
        id: projectId,
        domain: projectDomain ?? projectId,
        path: projectPath,
        linked: true,
      });
      if (vnextConfig) {
        setVnextConfig(vnextConfig);
      }

      if (changedProject) {
        void refreshFileTree().catch((error) => {
          logger.warn('Failed to refresh file tree after host navigation', {
            error: (error as Error).message,
          });
        });
      }

      if (route.navigateTo) {
        navigate(route.navigateTo);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate]);

  return null;
}
