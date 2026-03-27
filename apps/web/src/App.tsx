import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { ProjectListPage } from './routes/index';
import { ProjectWorkspacePage } from './routes/project.$id';
import { FlowEditorPage } from './routes/project.$id.flow.$key';
import { TaskEditorPage } from './routes/project.$id.task.$group.$name';
import { SchemaEditorPage } from './routes/project.$id.schema.$group.$name';
import { ViewEditorPage } from './routes/project.$id.view.$group.$name';
import { FunctionEditorPage } from './routes/project.$id.function.$group.$name';
import { ExtensionEditorPage } from './routes/project.$id.extension.$group.$name';
import { CodeEditorPage } from './routes/project.$id.code';

export function App() {
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
