import { Outlet } from 'react-router-dom';

import { RuntimeHealthSync } from '@modules/workflow-execution/RuntimeHealthSync';
import { HostNavigationBridge } from '@shared/api/HostNavigationBridge';

/**
 * Minimal shell used when the web app runs inside the VS Code webview.
 * All chrome (activity bar, sidebar, status bar) has been removed — file
 * browsing and project selection happen in the VS Code Explorer instead.
 */
export function AppLayout() {
  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      <RuntimeHealthSync />
      <HostNavigationBridge />

      <main className="bg-background flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
