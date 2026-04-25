import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { ProjectNavigationProvider } from '@vnext-forge/designer-ui';
import { lazy, Suspense, type ReactNode } from 'react';

import { RouteSkeleton } from './RouteSkeleton';

const ProjectListPage = lazy(() =>
  import('../pages/project-list/ProjectListPage').then((m) => ({ default: m.ProjectListPage })),
);
const AppLayout = lazy(() => import('./layouts/AppLayout').then((m) => ({ default: m.AppLayout })));
const ProjectEditorShell = lazy(() =>
  import('./layouts/ProjectEditorShell').then((m) => ({ default: m.ProjectEditorShell })),
);
const ProjectWorkspacePage = lazy(() =>
  import('../pages/project-workspace/ProjectWorkspacePage').then((m) => ({
    default: m.ProjectWorkspacePage,
  })),
);
const FlowEditorPage = lazy(() =>
  import('../pages/flow-editor/FlowEditorPage').then((m) => ({ default: m.FlowEditorPage })),
);
const TaskEditorPage = lazy(() =>
  import('../pages/task-editor/TaskEditorPage').then((m) => ({ default: m.TaskEditorPage })),
);
const SchemaEditorPage = lazy(() =>
  import('../pages/schema-editor/SchemaEditorPage').then((m) => ({ default: m.SchemaEditorPage })),
);
const ViewEditorPage = lazy(() =>
  import('../pages/view-editor/ViewEditorPage').then((m) => ({ default: m.ViewEditorPage })),
);
const FunctionEditorPage = lazy(() =>
  import('../pages/function-editor/FunctionEditorPage').then((m) => ({
    default: m.FunctionEditorPage,
  })),
);
const ExtensionEditorPage = lazy(() =>
  import('../pages/extension-editor/ExtensionEditorPage').then((m) => ({
    default: m.ExtensionEditorPage,
  })),
);
const CodeEditorPage = lazy(() =>
  import('../pages/code-editor/CodeEditorPage').then((m) => ({ default: m.CodeEditorPage })),
);
const VnextWorkspaceConfigPage = lazy(() =>
  import('../pages/vnext-workspace-config/VnextWorkspaceConfigPage').then((m) => ({
    default: m.VnextWorkspaceConfigPage,
  })),
);
const TestPage = lazy(() => import('../pages/test/TestPage').then((m) => ({ default: m.TestPage })));

/**
 * Bridges React Router's `useNavigate()` into the host-agnostic
 * `ProjectNavigation` contract consumed by designer-ui components. Only
 * mounted inside the web SPA — the VS Code extension webview omits this
 * provider entirely so designer-ui never depends on a router context at
 * runtime.
 */
function WebProjectNavigationAdapter({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ProjectNavigationProvider
      navigation={{
        navigateToProject(projectId) {
          navigate(`/project/${projectId}`);
        },
      }}>
      {children}
    </ProjectNavigationProvider>
  );
}

/**
 * Web SPA route tree. Mirrors the original (pre-extension) layout:
 *   - `/`                                  → project list (no chrome)
 *   - `/project/:id`                       → project workspace + chrome
 *   - `/project/:id/{flow,task,…}/…`       → editor pages + chrome
 *   - `/test`                              → component playground
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <WebProjectNavigationAdapter>
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route index element={<ProjectListPage />} />
            <Route element={<AppLayout />}>
              <Route path="project">
                <Route path=":id" element={<ProjectEditorShell />}>
                  <Route index element={<ProjectWorkspacePage />} />
                  <Route path="flow/:group/:name" element={<FlowEditorPage />} />
                  <Route path="task/:group/:name" element={<TaskEditorPage />} />
                  <Route path="schema/:group/:name" element={<SchemaEditorPage />} />
                  <Route path="view/:group/:name" element={<ViewEditorPage />} />
                  <Route path="function/:group/:name" element={<FunctionEditorPage />} />
                  <Route path="extension/:group/:name" element={<ExtensionEditorPage />} />
                  <Route path="workspace-config" element={<VnextWorkspaceConfigPage />} />
                  <Route path="code/*" element={<CodeEditorPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="/test" element={<TestPage />} />
          </Routes>
        </Suspense>
      </WebProjectNavigationAdapter>
    </BrowserRouter>
  );
}
