import { useParams } from 'react-router-dom';
import { useProjectStore } from '@app/store/useProjectStore';
import { useComponentStore } from '@app/store/useComponentStore';
import { useSaveComponent } from '@modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '@modules/save-component/components/ComponentEditorLayout';
import { useTaskEditor } from './useTaskEditor';
import { TaskEditorPanel } from './TaskEditorPanel';

export function TaskEditorView() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { activeProject, vnextConfig } = useProjectStore();
  const componentJson = useComponentStore((state) => state.componentJson);
  const isDirty = useComponentStore((state) => state.isDirty);
  const updateComponent = useComponentStore((state) => state.updateComponent);
  const undo = useComponentStore((state) => state.undo);
  const redo = useComponentStore((state) => state.redo);
  const undoStackLength = useComponentStore((state) => state.undoStack.length);
  const redoStackLength = useComponentStore((state) => state.redoStack.length);
  const { save, saving, saveError } = useSaveComponent();
  const filePath =
    id && group && name && activeProject && vnextConfig
      ? `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.tasks}/${group}/${name}.json`
      : null;
  const { loading, error, isReady } = useTaskEditor({ filePath });

  if (loading || !isReady || !componentJson) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
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
      hasSaved={!isDirty && undoStackLength > 0}
      saving={saving}
      saveErrorMessage={saveError?.toUserMessage().message ?? null}
      onSave={save}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStackLength > 0}
      canRedo={redoStackLength > 0}>
      <TaskEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
