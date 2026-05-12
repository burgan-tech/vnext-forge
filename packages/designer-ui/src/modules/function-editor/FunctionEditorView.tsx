import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { HostDocumentToolbarSlot } from '../../modules/save-component/components/hostDocumentToolbarSlot';
import { useProjectStore } from '../../store/useProjectStore';
import { useComponentStore } from '../../store/useComponentStore';
import { useEditorPanelsStore } from '../../store/useEditorPanelsStore';
import { useScriptPanelStore } from '../../modules/code-editor/ScriptPanelStore';
import { useSaveComponent } from '../../modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import { usePublish } from '../../modules/save-component/PublishContext.js';
import {
  ComponentEditorModalProvider,
  useComponentEditorModalState,
} from '../save-component/ComponentEditorModalContext.js';
import {
  FlowEditorCanvasAndScriptResizableColumn,
  ScriptEditorPanel,
} from '../../modules/code-editor/layout/ScriptEditorPanel';
import { useFunctionEditor } from './UseFunctionEditor';
import { FunctionEditorPanel } from './components/FunctionEditorPanel';
import { buildAtomicComponentJsonPath } from '../vnext-workspace/atomicComponentPaths.js';
import type { AtomicSavedInfo } from '../save-component/componentEditorModalTypes.js';

export interface FunctionEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  registerToolbar?: HostDocumentToolbarSlot;
  layoutSurface?: 'panel' | 'modal';
  onAtomicSaved?: (info: AtomicSavedInfo) => void;
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}

/**
 * Restores the parent component store snapshot when the modal editor dialog
 * transitions from open → closed. Only fires on that edge, never on initial
 * mount or while the modal is still closed.
 */
function ModalCloseRestoreEffect() {
  const { open } = useComponentEditorModalState();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      const { _snapshot, restoreSnapshot } = useComponentStore.getState();
      if (_snapshot) restoreSnapshot();
    }
  }, [open]);

  return null;
}

export function FunctionEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
  layoutSurface = 'panel',
  onAtomicSaved,
  onOpenScriptFileInHost,
}: FunctionEditorViewProps) {
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
  const { save, saving, saveError, autoSavePending, autoSaved } = useSaveComponent({
    componentType: 'function',
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
      ? buildAtomicComponentJsonPath(activeProject.path, vnextConfig.paths, 'functions', group, name)
      : null;
  const { loading, error, functionDocument } = useFunctionEditor({ filePath });
  const isEditorReady = Boolean(
    functionDocument && componentJson && componentFilePath === filePath,
  );

  const scriptPanelOpen = useEditorPanelsStore((s) => s.scriptPanelOpen);
  const activeScript = useScriptPanelStore((s) => s.activeScript);

  const componentDirectoryPath = useMemo(() => {
    if (!activeProject || !vnextConfig) return undefined;
    const base = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.functions}`;
    return (group ? `${base}/${group}` : base)
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/');
  }, [activeProject, vnextConfig, group]);

  const { publish: publishFile, publishing, canPublish } = usePublish();
  const handlePublish = useCallback(() => {
    void publishFile(save, filePath);
  }, [publishFile, save, filePath]);

  const handleBeforeOpenModal = useCallback(() => {
    useComponentStore.getState().snapshotState();
  }, []);

  useEffect(() => {
    return useScriptPanelStore.subscribe((state, prev) => {
      if (!state.activeScript?.value || state.activeScript.value === prev.activeScript?.value) return;
      const script = state.activeScript;

      const { updateComponent: update } = useComponentStore.getState();

      if (script.listField === 'attributes' && script.scriptField === 'task.mapping') {
        update((draft) => {
          const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
          const t = (attrs.task ?? {}) as Record<string, unknown>;
          t.mapping = script.value;
          attrs.task = t;
          draft.attributes = attrs;
        });
        return;
      }

      if (script.listField === 'onExecutionTasks') {
        update((draft) => {
          const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
          const tasks = attrs.onExecutionTasks as Record<string, unknown>[] | undefined;
          if (!Array.isArray(tasks) || !tasks[script.index]) return;
          tasks[script.index][script.scriptField] = script.value;
        });
        return;
      }

      if (script.listField === 'functionOutputMapping') {
        update((draft) => {
          const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
          attrs.output = script.value;
          draft.attributes = attrs;
        });
      }
    });
  }, []);

  const content =
    loading || !isEditorReady || !componentJson ? (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading function...'}
      </div>
    ) : (
      <FlowEditorCanvasAndScriptResizableColumn
        canvas={
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
            autoSaved={autoSaved}>
            <FunctionEditorPanel
              json={componentJson}
              onChange={updateComponent}
              onBeforeOpenModal={handleBeforeOpenModal}
            />
          </ComponentEditorLayout>
        }
        scriptPanel={
          scriptPanelOpen && activeScript ? (
            <ScriptEditorPanel
              workflowDirectoryPath={componentDirectoryPath}
              onOpenScriptFileInHost={onOpenScriptFileInHost}
            />
          ) : null
        }
      />
    );

  return (
    <ComponentEditorModalProvider onOpenScriptFileInHost={onOpenScriptFileInHost}>
      <ModalCloseRestoreEffect />
      {content}
    </ComponentEditorModalProvider>
  );
}
