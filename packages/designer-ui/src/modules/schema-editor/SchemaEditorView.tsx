import type { ReactNode } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import { SchemaEditorPanel } from './components/SchemaEditorPanel';
import { useSchemaEditor } from './useSchemaEditor';
import { useSchemaEditorStore } from './useSchemaEditorStore';

export interface SchemaEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  registerToolbar?: (toolbar: ReactNode | null) => void;
}

export function SchemaEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
}: SchemaEditorViewProps) {
  const { activeProject, vnextConfig } = useProjectStore();
  const {
    componentJson,
    isDirty,
    updateComponent,
    undo,
    redo,
    undoStack,
    redoStack,
  } = useSchemaEditorStore();
  const filePath =
    id && group && name && activeProject && vnextConfig
      ? `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.schemas}/${group}/${name}.json`
      : null;
  const { loading, error, isReady, save, saving, saveError } = useSchemaEditor({ filePath });

  if (loading || !isReady || !componentJson) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading schema...'}
      </div>
    );
  }

  return (
    <ComponentEditorLayout
      registerToolbar={registerToolbar}
      isDirty={isDirty}
      hasSaved={!isDirty && undoStack.length > 0}
      saving={saving}
      saveErrorMessage={saveError?.toUserMessage().message ?? null}
      onSave={save}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}
    >
      <SchemaEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
