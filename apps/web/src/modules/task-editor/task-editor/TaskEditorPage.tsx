import { useParams } from 'react-router-dom';
import { useProjectStore } from '@app/store/useProjectStore';
import { loadComponentFile } from '@modules/save-component/SaveComponentApi';
import { useComponentStore } from '@modules/save-component/useComponentStore';
import { useLoadComponent } from '@modules/save-component/useLoadComponent';
import { useSaveComponent } from '@modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '@modules/save-component/components/ComponentEditorLayout';
import { TaskEditorPanel } from './TaskEditorPanel';

export function TaskEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { activeProject, vnextConfig } = useProjectStore();
  const { componentJson, isDirty, updateComponent, undo, redo, undoStack, redoStack } = useComponentStore();
  const { save, saving, saveError } = useSaveComponent();
  const filePath = id && group && name && activeProject && vnextConfig
    ? `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.tasks}/${group}/${name}.json`
    : null;
  const { loading, error, isReady } = useLoadComponent({
    filePath,
    componentType: 'task',
    loadComponent: loadComponentFile,
    createArgs: (nextFilePath) => ({
      filePath: nextFilePath,
      errorMessage: 'Task could not be loaded.',
    }),
    errorMessage: 'Task could not be loaded.',
  });

  if (loading || !isReady || !componentJson) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {error?.toUserMessage().message || 'Loading task...'}
      </div>
    );
  }

  return (
    <ComponentEditorLayout
      projectId={id || ''}
      projectDomain={activeProject?.domain}
      typeName="Tasks"
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
      <TaskEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
