import { Outlet } from 'react-router-dom';

import { useUIStore } from '@app/store/UiStore';

import { ActivityBar } from './ui/ActivityBar';
import { Sidebar } from './ui/Sidebar';
import { StatusBar } from './ui/StatusBar';

export function AppLayout() {
  const { sidebarOpen, sidebarWidth } = useUIStore();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />

        {sidebarOpen && (
          <aside
            className="shrink-0 overflow-y-auto border-r border-border bg-surface/80 backdrop-blur-sm"
            style={{ width: sidebarWidth }}>
            <Sidebar />
          </aside>
        )}

        <main className="flex-1 overflow-hidden bg-background">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
