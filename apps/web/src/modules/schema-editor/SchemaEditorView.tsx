import { useParams } from 'react-router-dom';
import { useProjectStore } from '@app/store/useProjectStore';
import { ComponentEditorLayout } from '@modules/save-component/components/ComponentEditorLayout';
import { SchemaEditorPanel } from './components/SchemaEditorPanel';
import { useSchemaEditor } from './useSchemaEditor';
import { useSchemaEditorStore } from './useSchemaEditorStore';

export function SchemaEditorView() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
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
      projectId={id || ''}
      projectDomain={activeProject?.domain}
      typeName="Schemas"
      group={group || ''}
      name={name || ''}
      isDirty={isDirty}
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
