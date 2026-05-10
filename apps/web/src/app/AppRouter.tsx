import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { ProjectNavigationProvider } from '@vnext-forge-studio/designer-ui';
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
const QuickRunPage = lazy(() =>
  import('../pages/quickrun/QuickRunPage').then((m) => ({ default: m.QuickRunPage })),
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
 * Catch-all panel rendered when a route inside `/project/:id/*` (or at the
 * very root) doesn't match any registered editor.
 *
 * Without this, React Router emits `No routes matched location ...` and
 * leaves a blank screen — the failure mode users hit when the file-tree
 * resolver navigates to e.g. `/project/messaging-gateway/flow/test` for a
 * stray top-level workflow file (no `<group>/` folder). The blank-screen
 * has no UI affordances to recover from; only Cmd+R / native menu reload
 * brings the app back. This panel turns that into a clear, recoverable
 * state.
 */
function NotFoundPanel() {
  const location = useLocation();
  const params = useParams();
  const projectId = (params as Record<string, string | undefined>).id;
  const goHome = projectId ? `/project/${projectId}` : '/';
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-foreground/80 text-base font-semibold">
        Editor not available for this path
      </div>
      <div className="text-foreground/60 max-w-xl text-xs">
        <code className="rounded bg-zinc-800/40 px-1.5 py-0.5 font-mono">
          {location.pathname}
        </code>{' '}
        doesn&apos;t map to a known editor route. The file may be at the project
        root (component editors require <code className="font-mono">&lt;type&gt;/&lt;group&gt;/&lt;name&gt;.json</code>),
        or live outside the configured component folders in{' '}
        <code className="font-mono">vnext.config.json</code>.
      </div>
      <Link
        to={goHome}
        className="text-foreground/90 hover:bg-foreground/10 mt-2 rounded border border-zinc-700/60 px-3 py-1.5 text-xs">
        {projectId ? 'Back to project workspace' : 'Back to project list'}
      </Link>
    </div>
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
                  <Route path="quickrun/:group/:name" element={<QuickRunPage />} />
                  <Route path="task/:group/:name" element={<TaskEditorPage />} />
                  <Route path="schema/:group/:name" element={<SchemaEditorPage />} />
                  <Route path="view/:group/:name" element={<ViewEditorPage />} />
                  <Route path="function/:group/:name" element={<FunctionEditorPage />} />
                  <Route path="extension/:group/:name" element={<ExtensionEditorPage />} />
                  <Route path="workspace-config" element={<VnextWorkspaceConfigPage />} />
                  <Route path="code/*" element={<CodeEditorPage />} />
                  {/* Project-scoped catch-all: keeps shell chrome, shows
                      a Back button + clear "no editor for this path"
                      message instead of a blank screen. */}
                  <Route path="*" element={<NotFoundPanel />} />
                </Route>
              </Route>
            </Route>
            <Route path="/test" element={<TestPage />} />
            {/* Top-level catch-all: shown when a page outside the project
                shell can't be matched (rare; protects against typo URLs). */}
            <Route path="*" element={<NotFoundPanel />} />
          </Routes>
        </Suspense>
      </WebProjectNavigationAdapter>
    </BrowserRouter>
  );
}
