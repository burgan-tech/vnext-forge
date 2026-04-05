import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { TestPage } from '@pages/test/test-page';

import { AppLayout } from '../../layout/AppLayout';
import { CodeEditorPage } from '../../routes/project.$id.code';
import { ExtensionEditorPage } from '../../routes/project.$id.extension.$group.$name';
import { FlowEditorPage } from '../../routes/project.$id.flow.$key';
import { FunctionEditorPage } from '../../routes/project.$id.function.$group.$name';
import { ProjectWorkspacePage } from '../../routes/project.$id';
import { ProjectListPage } from '../../routes/index';
import { SchemaEditorPage } from '../../routes/project.$id.schema.$group.$name';
import { TaskEditorPage } from '../../routes/project.$id.task.$group.$name';
import { ViewEditorPage } from '../../routes/project.$id.view.$group.$name';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<ProjectListPage />} />
          <Route path="project/:id" element={<ProjectWorkspacePage />} />
          <Route path="project/:id/flow/:group/:name" element={<FlowEditorPage />} />
          <Route path="project/:id/task/:group/:name" element={<TaskEditorPage />} />
          <Route path="project/:id/schema/:group/:name" element={<SchemaEditorPage />} />
          <Route path="project/:id/view/:group/:name" element={<ViewEditorPage />} />
          <Route path="project/:id/function/:group/:name" element={<FunctionEditorPage />} />
          <Route path="project/:id/extension/:group/:name" element={<ExtensionEditorPage />} />
          <Route path="project/:id/code/*" element={<CodeEditorPage />} />
          <Route path="/test" element={<TestPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
