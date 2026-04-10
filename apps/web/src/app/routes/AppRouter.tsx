import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@app/layouts/AppLayout';
import { CodeEditorPage } from '@pages/code-editor/CodeEditorPage';
import { ExtensionEditorPage } from '@pages/extension-editor/ExtensionEditorPage';
import { FlowEditorPage } from '@pages/flow-editor/FlowEditorPage';
import { FunctionEditorPage } from '@pages/function-editor/FunctionEditorPage';
import { ProjectListPage } from '@pages/project-list/ProjectListPage';
import { ProjectWorkspacePage } from '@pages/project-workspace/ProjectWorkspacePage';
import { SchemaEditorPage } from '@pages/schema-editor/SchemaEditorPage';
import { TaskEditorPage } from '@pages/task-editor/TaskEditorPage';
import { TestPage } from '@pages/test/TestPage';
import { ViewEditorPage } from '@pages/view-editor/ViewEditorPage';

export function AppRouter() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
