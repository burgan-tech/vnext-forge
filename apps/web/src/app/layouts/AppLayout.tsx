import { Outlet } from 'react-router-dom';

import { useUIStore } from '@app/store/useUiStore';
import { RuntimeHealthSync } from '@modules/workflow-execution/RuntimeHealthSync';

import { ActivityBar } from './ui/ActivityBar';
import { Sidebar } from './ui/Sidebar';
import { StatusBar } from './ui/StatusBar';

export function AppLayout() {
  const { sidebarOpen, sidebarWidth } = useUIStore();

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      <RuntimeHealthSync />
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
