import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';

import { AppShell } from './layout/AppShell';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { DashboardPage } from '@monitoring/pages/DashboardPage';
import { DefinitionsPage } from '@monitoring/pages/DefinitionsPage';
import { ComponentDetailPage } from '@monitoring/pages/ComponentDetailPage';
import { InstanceDetailPage } from '@monitoring/pages/InstanceDetailPage';
import { JobsPage } from '@monitoring/pages/JobsPage';
import { FaultsPage } from '@monitoring/pages/FaultsPage';
import { ConfigPage } from '@monitoring/pages/ConfigPage';
import { NotFoundPage } from '@monitoring/pages/NotFoundPage';

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="definitions/:type" element={<DefinitionsPage />} />
            <Route path="definitions/:type/:id" element={<ComponentDetailPage />} />
            <Route
              path="definitions/workflows/:wfId/instances/:instanceId"
              element={<InstanceDetailPage />}
            />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="faults" element={<FaultsPage />} />
            <Route path="config" element={<ConfigPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
