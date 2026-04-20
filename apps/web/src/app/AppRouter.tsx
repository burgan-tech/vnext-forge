import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { ProjectNavigationProvider } from '@vnext-forge/designer-ui';
import { useEffect, type ReactNode } from 'react';

import { useThemeStore } from './store/useThemeStore';
import { CodeEditorPage } from '../pages/code-editor/CodeEditorPage';
import { ExtensionEditorPage } from '../pages/extension-editor/ExtensionEditorPage';
import { FlowEditorPage } from '../pages/flow-editor/FlowEditorPage';
import { FunctionEditorPage } from '../pages/function-editor/FunctionEditorPage';
import { ProjectListPage } from '../pages/project-list/ProjectListPage';
import { ProjectWorkspacePage } from '../pages/project-workspace/ProjectWorkspacePage';
import { SchemaEditorPage } from '../pages/schema-editor/SchemaEditorPage';
import { TaskEditorPage } from '../pages/task-editor/TaskEditorPage';
import { TestPage } from '../pages/test/TestPage';
import { ViewEditorPage } from '../pages/view-editor/ViewEditorPage';
import { AppLayout } from './layouts/AppLayout';

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
 * Mirrors the active theme onto `<html data-theme>` so Tailwind tokens can
 * react to it. The `system` value defers to the user's OS preference. The
 * extension webview never mounts this — its theme tracks VS Code itself.
 */
function ThemeEffect() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      root.dataset.theme = theme;
    }
  }, [theme]);
  return null;
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
      <ThemeEffect />
      <WebProjectNavigationAdapter>
        <Routes>
          <Route index element={<ProjectListPage />} />
          <Route element={<AppLayout />}>
            <Route path="project">
              <Route path=":id" element={<ProjectWorkspacePage />} />
              <Route path=":id/flow/:group/:name" element={<FlowEditorPage />} />
              <Route path=":id/task/:group/:name" element={<TaskEditorPage />} />
              <Route path=":id/schema/:group/:name" element={<SchemaEditorPage />} />
              <Route path=":id/view/:group/:name" element={<ViewEditorPage />} />
              <Route path=":id/function/:group/:name" element={<FunctionEditorPage />} />
              <Route path=":id/extension/:group/:name" element={<ExtensionEditorPage />} />
              <Route path=":id/code/*" element={<CodeEditorPage />} />
            </Route>
          </Route>
          <Route path="/test" element={<TestPage />} />
        </Routes>
      </WebProjectNavigationAdapter>
    </BrowserRouter>
  );
}
