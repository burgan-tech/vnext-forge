import { useParams } from 'react-router-dom';
import { useProjectStore } from '@app/store/useProjectStore';
import { useComponentStore } from '@modules/save-component/useComponentStore';
import { useSaveComponent } from '@modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '@modules/save-component/components/ComponentEditorLayout';
import { useFunctionEditor } from './UseFunctionEditor';
import { FunctionEditorPanel } from './components/FunctionEditorPanel';

export function FunctionEditorView() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { activeProject, vnextConfig } = useProjectStore();
  const {
    componentJson,
    filePath: componentFilePath,
    isDirty,
    updateComponent,
    undo,
    redo,
    undoStack,
    redoStack,
  } = useComponentStore();
  const { save, saving, saveError } = useSaveComponent();
  const filePath = id && group && name && activeProject && vnextConfig
    ? `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.functions}/${group}/${name}.json`
    : null;
  const { loading, error, functionDocument } = useFunctionEditor({ filePath });
  const isEditorReady = Boolean(functionDocument && componentJson && componentFilePath === filePath);

  if (loading || !isEditorReady || !componentJson) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {error?.toUserMessage().message || 'Loading function...'}
      </div>
    );
  }

  return (
    <ComponentEditorLayout
      projectId={id || ''}
      projectDomain={activeProject?.domain}
      typeName="Functions"
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
      <FunctionEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
