import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@app/layouts/AppLayout';
import { CodeEditorPage } from '@pages/code-editor/CodeEditorPage';
import { EmptyStatePage } from '@pages/empty/EmptyStatePage';
import { ExtensionEditorPage } from '@pages/extension-editor/ExtensionEditorPage';
import { FlowEditorPage } from '@pages/flow-editor/FlowEditorPage';
import { FunctionEditorPage } from '@pages/function-editor/FunctionEditorPage';
import { SchemaEditorPage } from '@pages/schema-editor/SchemaEditorPage';
import { TaskEditorPage } from '@pages/task-editor/TaskEditorPage';
import { ViewEditorPage } from '@pages/view-editor/ViewEditorPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<EmptyStatePage />} />
          <Route path="project">
            <Route path=":id/flow/:group/:name" element={<FlowEditorPage />} />
            <Route path=":id/task/:group/:name" element={<TaskEditorPage />} />
            <Route path=":id/schema/:group/:name" element={<SchemaEditorPage />} />
            <Route path=":id/view/:group/:name" element={<ViewEditorPage />} />
            <Route path=":id/function/:group/:name" element={<FunctionEditorPage />} />
            <Route path=":id/extension/:group/:name" element={<ExtensionEditorPage />} />
            <Route path=":id/code/*" element={<CodeEditorPage />} />
          </Route>
          <Route path="*" element={<EmptyStatePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
