import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@app/layouts/app-layout';
import { ProjectWorkspacePage } from '@pages/project-workspace/ui/project-workspace-page';
import { ProjectListPage } from '@pages/project-list/ui/project-list-page';
import { TestPage } from '@pages/test/test-page';

import { CodeEditorPage } from '../../routes/CodeEditorPage';
import { ExtensionEditorPage } from '../../routes/ExtensionEditorPage';
import { FlowEditorPage } from '../../routes/FlowEditorPage';
import { FunctionEditorPage } from '../../routes/FunctionEditorPage';
import { SchemaEditorPage } from '../../routes/SchemaEditorPage';
import { TaskEditorPage } from '../../routes/TaskEditorPage';
import { ViewEditorPage } from '../../routes/ViewEditorPage';

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
