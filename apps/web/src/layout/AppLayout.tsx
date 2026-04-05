import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ActivityBar } from './ActivityBar';
import { StatusBar } from './StatusBar';
import { useUIStore } from '../stores/ui-store';

export function AppLayout() {
  const { sidebarOpen, sidebarWidth } = useUIStore();
  const location = useLocation();
  const isLanding = location.pathname === '/';

  if (isLanding) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />

        {sidebarOpen && (
          <aside
            className="shrink-0 overflow-y-auto border-r border-slate-200/70 bg-white/80 backdrop-blur-sm"
            style={{ width: sidebarWidth }}>
            <Sidebar />
          </aside>
        )}

        <main className="flex-1 overflow-hidden bg-slate-50">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
