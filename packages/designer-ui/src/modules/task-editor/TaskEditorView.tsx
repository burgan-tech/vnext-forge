import { useCallback } from 'react';
import { isFailure } from '@vnext-forge/app-contracts';

import { useProjectStore } from '../../store/useProjectStore';
import { useComponentStore } from '../../store/useComponentStore';
import { useSaveComponent } from '../../modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import type { HostDocumentToolbarSlot } from '../../modules/save-component/components/hostDocumentToolbarSlot';
import { showNotification } from '../../notification/notification-port.js';
import { useTaskEditor } from './useTaskEditor';
import { TaskEditorPanel } from './TaskEditorPanel';
import { persistScriptTaskScriptFile } from './persistScriptTaskScriptFile.js';

export interface TaskEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  registerToolbar?: HostDocumentToolbarSlot;
  /** Web shell: open script file in full Monaco tab. */
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}

export function TaskEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
  onOpenScriptFileInHost,
}: TaskEditorViewProps) {
  const { activeProject, vnextConfig } = useProjectStore();
  const componentJson = useComponentStore((state) => state.componentJson);
  const isDirty = useComponentStore((state) => state.isDirty);
  const updateComponent = useComponentStore((state) => state.updateComponent);
  const undo = useComponentStore((state) => state.undo);
  const redo = useComponentStore((state) => state.redo);
  const undoStackLength = useComponentStore((state) => state.undoStack.length);
  const redoStackLength = useComponentStore((state) => state.redoStack.length);
  const beforeSave = useCallback(async () => {
    const { componentJson, filePath: fp } = useComponentStore.getState();
    if (!componentJson || !fp) return true;
    const res = await persistScriptTaskScriptFile(fp, componentJson);
    if (isFailure(res)) {
      showNotification({
        kind: 'error',
        message: res.error.message || 'Could not save script file.',
      });
      return false;
    }
    if (!res.data.skipped && res.data.created) {
      showNotification({
        kind: 'success',
        message: 'New script file created.',
      });
    }
    return true;
  }, []);

  const { save, saving, saveError } = useSaveComponent({
    beforeSave,
  });
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
      registerToolbar={registerToolbar}
      isDirty={isDirty}
      hasSaved={!isDirty && undoStackLength > 0}
      saving={saving}
      saveErrorMessage={saveError?.toUserMessage().message ?? null}
      onSave={save}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStackLength > 0}
      canRedo={redoStackLength > 0}>
      <TaskEditorPanel
        json={componentJson}
        onChange={updateComponent}
        onOpenScriptFileInHost={onOpenScriptFileInHost}
      />
    </ComponentEditorLayout>
  );
}
