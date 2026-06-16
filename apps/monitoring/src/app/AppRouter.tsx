import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';

import { AppShell } from './layout/AppShell';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { DashboardPage } from '@monitoring/pages/DashboardPage';
import { DefinitionsPage } from '@monitoring/pages/DefinitionsPage';
import { ComponentDetailPage } from '@monitoring/pages/ComponentDetailPage';
import { InstanceListPage } from '@monitoring/pages/InstanceListPage';
import { InstanceDetailPage } from '@monitoring/pages/InstanceDetailPage';
import { TaskExecutionsPage } from '@monitoring/pages/TaskExecutionsPage';
import { TaskExecutionDetailPage } from '@monitoring/pages/TaskExecutionDetailPage';
import { FunctionExecutionsPage } from '@monitoring/pages/FunctionExecutionsPage';
import { FunctionExecutionDetailPage } from '@monitoring/pages/FunctionExecutionDetailPage';
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
            <Route
              path="definitions/workflows/:wfId/instances"
              element={<InstanceListPage />}
            />
            <Route path="definitions/:type/:id" element={<ComponentDetailPage />} />
            <Route path="instances/:instanceId" element={<InstanceDetailPage />} />
            <Route path="task-executions" element={<TaskExecutionsPage />} />
            <Route path="task-executions/:execId" element={<TaskExecutionDetailPage />} />
            <Route path="function-executions" element={<FunctionExecutionsPage />} />
            <Route
              path="function-executions/:execId"
              element={<FunctionExecutionDetailPage />}
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
