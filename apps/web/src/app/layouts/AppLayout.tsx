import { matchPath, Outlet, useLocation } from 'react-router-dom';

import { useProjectStore } from '@app/store/useProjectStore';
import { useVnextWorkspaceUiStore } from '@app/store/useVnextWorkspaceUiStore';
import { useUIStore } from '@app/store/useUiStore';
import { useWorkspaceDiagnosticsStore } from '@app/store/useWorkspaceDiagnosticsStore';
import { RuntimeHealthSync } from '@modules/workflow-execution/RuntimeHealthSync';
import { CreateVnextConfigDialog } from '@modules/project-workspace/components/CreateVnextConfigDialog';
import { syncVnextWorkspaceFromDisk } from '@modules/project-workspace/syncVnextWorkspaceFromDisk';

import { ActivityBar } from './ui/ActivityBar';
import { Sidebar } from './ui/Sidebar';
import { StatusBar } from './ui/StatusBar';

function routeProjectIdFromPathname(pathname: string): string | undefined {
  const m = matchPath({ path: '/project/:id', end: false }, pathname);
  const raw = m?.params.id;
  return raw && raw.length > 0 ? raw : undefined;
}

export function AppLayout() {
  const location = useLocation();
  const { sidebarOpen, sidebarWidth } = useUIStore();
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.vnextConfigWizardOpen);
  const setVnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.setVnextConfigWizardOpen);

  const routeProjectId = routeProjectIdFromPathname(location.pathname);
  const projectId = activeProject?.id ?? routeProjectId;

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
    await useProjectStore.getState().refreshFileTree();
  };

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      <RuntimeHealthSync />

      {projectId ? (
        <CreateVnextConfigDialog
          projectId={projectId}
          defaultDomain={activeProject?.domain ?? projectId}
          open={vnextConfigWizardOpen}
          onOpenChange={handleWizardOpenChange}
          onCompleted={handleWizardCompleted}
        />
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />

        {sidebarOpen && (
          <aside
            className="border-border bg-surface/80 shrink-0 overflow-y-auto border-r backdrop-blur-sm"
            style={{ width: sidebarWidth }}>
            <Sidebar />
          </aside>
        )}

        <main className="bg-background flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
