import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@app/layouts/app-layout';
import { CodeEditorPage } from '@pages/code-editor';
import { ExtensionEditorPage } from '@pages/extension-editor';
import { FlowEditorPage } from '@pages/flow-editor';
import { FunctionEditorPage } from '@pages/function-editor';
import { ProjectListPage } from '@pages/project-list';
import { ProjectWorkspacePage } from '@pages/project-workspace';
import { SchemaEditorPage } from '@pages/schema-editor';
import { TaskEditorPage } from '@pages/task-editor';
import { TestPage } from '@pages/test';
import { ViewEditorPage } from '@pages/view-editor';

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
