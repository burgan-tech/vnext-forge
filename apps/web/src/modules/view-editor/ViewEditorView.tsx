import { useParams } from 'react-router-dom';
import { useComponentStore } from '@app/store/useComponentStore';
import { useProjectStore } from '@app/store/useProjectStore';
import { ComponentEditorLayout } from '@modules/save-component/components/ComponentEditorLayout';
import { useLoadComponent } from '@modules/save-component/useLoadComponent';
import { useSaveComponent } from '@modules/save-component/useSaveComponent';
import { loadViewEditor } from './ViewEditorApi';
import { ViewEditorPanel } from './ViewEditorPanel';

export function ViewEditorView() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { activeProject, vnextConfig } = useProjectStore();
  const { componentJson, isDirty, updateComponent, undo, redo, undoStack, redoStack } =
    useComponentStore();
  const { save, saving, saveError } = useSaveComponent();
  const filePath =
    id && group && name && activeProject && vnextConfig
      ? `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.views}/${group}/${name}.json`
      : null;

  const { loading, error, isReady } = useLoadComponent({
    filePath,
    componentType: 'view',
    loadComponent: loadViewEditor,
    createArgs: (nextFilePath) => ({ filePath: nextFilePath }),
    errorMessage: 'View could not be loaded.',
  });

  if (loading || !isReady || !componentJson) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading view...'}
      </div>
    );
  }

  return (
    <ComponentEditorLayout
      projectId={id || ''}
      projectDomain={activeProject?.domain}
      typeName="Views"
      group={group || ''}
      name={name || ''}
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
      <ViewEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
