import { useMemo } from 'react';
import { matchPath, Outlet, useLocation } from 'react-router-dom';

import { RuntimeHealthSync, useProjectStore } from '@vnext-forge-studio/designer-ui';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useGroupRef,
} from '@vnext-forge-studio/designer-ui/ui';

import { useProjectListStore } from '../store/useProjectListStore';
import { useVnextWorkspaceUiStore } from '../store/useVnextWorkspaceUiStore';
import { useWebShellStore } from '../store/useWebShellStore';
import { useWorkspaceDiagnosticsStore } from '../store/useWorkspaceDiagnosticsStore';
import { CreateVnextConfigDialog } from '../../modules/project-workspace/components/CreateVnextConfigDialog';
import { useProjectWorkspacePage } from '../../modules/project-workspace/hooks/useProjectWorkspacePage';
import { syncVnextWorkspaceFromDisk } from '../../modules/project-workspace/syncVnextWorkspaceFromDisk';

import { RouteErrorBoundary } from '../RouteErrorBoundary';
import { ActivityBar } from './ui/ActivityBar';
import { Sidebar } from './ui/Sidebar';
import { StatusBar } from './ui/StatusBar';

function routeProjectIdFromPathname(pathname: string): string | undefined {
  const m = matchPath({ path: '/project/:id', end: false }, pathname);
  const raw = m?.params.id;
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Web SPA application shell: activity bar + sidebar + main outlet + status
 * bar. Lives in `apps/web` because the VS Code extension webview replaces
 * this chrome with VS Code's own UI surfaces.
 */
export function AppLayout() {
  const location = useLocation();
  const sidebarOpen = useWebShellStore((s) => s.sidebarOpen);
  const setSidebarWidth = useWebShellStore((s) => s.setSidebarWidth);

  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.vnextConfigWizardOpen);
  const setVnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.setVnextConfigWizardOpen);

  const routeProjectId = routeProjectIdFromPathname(location.pathname);
  const projectId = activeProject?.id ?? routeProjectId;
  const resizableShellGroupRef = useGroupRef();

  useProjectWorkspacePage(routeProjectId);

  /**
   * `react-resizable-panels` ilk ölçümde panel toplam genişliği 0 iken
   * `defaultLayoutDeferred` tutabiliyor; bu aşamada `getLayout`/`setLayout` boş ve ilk sürükleme etkisiz
   * kalabiliyor. Group seviyesinde yüzde `defaultLayout` vererek ilk geçerli layout'u aynı render'da
   * uygulatıyoruz. Bağımlılık listesinde `onResize` ile güncellenen `sidebarWidth` yok; böylece sürüklerken
   * `defaultLayout` yeniden hesaplanıp sürükleme sıfırlanmaz.
   */
  const shellResizableDefaultLayout = useMemo(() => {
    if (typeof window === 'undefined' || !sidebarOpen) {
      return undefined;
    }
    const activityBarWidthPx = 52;
    const total = Math.max(1, window.innerWidth - activityBarWidthPx);
    const sw = Math.min(440, Math.max(160, useWebShellStore.getState().sidebarWidth));
    const sidebarPct = (100 * sw) / total;
    const mainPct = 100 - sidebarPct;
    return {
      'app-shell-sidebar': Math.round(sidebarPct * 1000) / 1000,
      'app-shell-main': Math.round(mainPct * 1000) / 1000,
    } as const;
  }, [sidebarOpen, projectId, location.key]);

  const handleWizardOpenChange = (open: boolean) => {
    if (!open) {
      const { vnextConfig } = useProjectStore.getState();
      const { configIssues } = useWorkspaceDiagnosticsStore.getState();
      if (!vnextConfig && configIssues.length === 0) {
        useVnextWorkspaceUiStore.getState().setShowMissingVnextConfigBar(true);
      }
    }
    setVnextConfigWizardOpen(open);
  };

  const handleWizardCompleted = async (completedProjectId: string) => {
    const pid = completedProjectId || projectId;
    if (!pid) return;
    await syncVnextWorkspaceFromDisk(pid, { openWizardOnMissing: false });
    await useProjectListStore.getState().refreshFileTree();
  };

  return (
    <div
      className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden"
      style={
        {
          ['--designer-host-status-bar-height' as string]: '1.75rem',
        } as React.CSSProperties
      }>
      <RuntimeHealthSync />

      {projectId ? (
        <CreateVnextConfigDialog
          presentation="dialog"
          projectId={projectId}
          defaultDomain={activeProject?.domain ?? projectId}
          open={vnextConfigWizardOpen}
          onOpenChange={handleWizardOpenChange}
          onCompleted={handleWizardCompleted}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <ActivityBar />

        {sidebarOpen ? (
          <ResizablePanelGroup
            defaultLayout={shellResizableDefaultLayout}
            groupRef={resizableShellGroupRef}
            className="flex h-full min-h-0 min-w-0 flex-1"
            id="app-shell-resizable"
            orientation="horizontal">
            <ResizablePanel
              autoCollapseBelowMin
              className="bg-surface/80 flex min-h-0 min-w-0 flex-col overflow-hidden backdrop-blur-sm"
              collapseOvershootPx={30}
              id="app-shell-sidebar"
              maxSize={440}
              minSize={160}
              onResize={({ inPixels }) => {
                setSidebarWidth(Math.round(inPixels));
              }}>
              <Sidebar />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              className="flex min-h-0 min-w-0 flex-1 flex-col"
              id="app-shell-main"
              minSize="32%">
              <main className="bg-background min-h-0 min-w-0 flex-1 overflow-hidden">
                <RouteErrorBoundary>
                  <Outlet />
                </RouteErrorBoundary>
              </main>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <main className="bg-background min-h-0 min-w-0 flex-1 overflow-hidden">
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          </main>
        )}
      </div>

      <StatusBar />
    </div>
  );
}
