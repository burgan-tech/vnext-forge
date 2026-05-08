import { useCallback } from 'react';
import type { HostDocumentToolbarSlot } from '../../modules/save-component/components/hostDocumentToolbarSlot';
import { useComponentStore } from '../../store/useComponentStore';
import { useProjectStore } from '../../store/useProjectStore';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import { useLoadComponent } from '../../modules/save-component/useLoadComponent';
import { useSaveComponent } from '../../modules/save-component/useSaveComponent';
import { usePublish } from '../../modules/save-component/PublishContext.js';
import { loadViewEditor } from './ViewEditorApi';
import { ViewEditorPanel } from './ViewEditorPanel';
import { buildAtomicComponentJsonPath } from '../vnext-workspace/atomicComponentPaths.js';
import type { AtomicSavedInfo } from '../save-component/componentEditorModalTypes.js';

export interface ViewEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  registerToolbar?: HostDocumentToolbarSlot;
  layoutSurface?: 'panel' | 'modal';
  onAtomicSaved?: (info: AtomicSavedInfo) => void;
}

export function ViewEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
  layoutSurface = 'panel',
  onAtomicSaved,
}: ViewEditorViewProps) {
  const { activeProject, vnextConfig } = useProjectStore();
  const { componentJson, isDirty, updateComponent, undo, redo, undoStack, redoStack } =
    useComponentStore();
  const { save, saving, saveError, autoSavePending, autoSaved } = useSaveComponent({
    afterSaveSuccess: onAtomicSaved
      ? () => {
          const j = useComponentStore.getState().componentJson;
          if (!j) return;
          onAtomicSaved({
            key: String(j.key ?? ''),
            version: String(j.version ?? ''),
            domain: String(j.domain ?? ''),
            flow: String(j.flow ?? ''),
          });
        }
      : undefined,
  });
  const filePath =
    id && group != null && name && activeProject && vnextConfig
      ? buildAtomicComponentJsonPath(activeProject.path, vnextConfig.paths, 'views', group, name)
      : null;

  const { loading, error, isReady } = useLoadComponent({
    filePath,
    componentType: 'view',
    loadComponent: loadViewEditor,
    createArgs: (nextFilePath) => ({ filePath: nextFilePath }),
    errorMessage: 'View could not be loaded.',
  });

  const { publish: publishFile, publishing, canPublish } = usePublish();
  const handlePublish = useCallback(() => {
    void publishFile(save, filePath);
  }, [publishFile, save, filePath]);

  if (loading || !isReady || !componentJson) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading view...'}
      </div>
    );
  }

  return (
    <ComponentEditorLayout
      registerToolbar={registerToolbar}
      surface={layoutSurface}
      isDirty={isDirty}
      hasSaved={!isDirty && undoStack.length > 0}
      saving={saving}
      saveErrorMessage={saveError?.toUserMessage().message ?? null}
      onSave={save}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}
      onPublish={canPublish ? handlePublish : undefined}
      publishing={publishing}
      autoSavePending={autoSavePending}
      autoSaved={autoSaved}
    >
      <ViewEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
