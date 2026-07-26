import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isFailure } from '@vnext-forge-studio/app-contracts';

import { useProjectStore } from '../../store/useProjectStore';
import { useComponentStore } from '../../store/useComponentStore';
import { useEditorPanelsStore } from '../../store/useEditorPanelsStore';
import { useScriptPanelStore } from '../../modules/code-editor/ScriptPanelStore';
import { useSaveComponent } from '../../modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import type { HostDocumentToolbarSlot } from '../../modules/save-component/components/hostDocumentToolbarSlot';
import { usePublish } from '../../modules/save-component/PublishContext.js';
import { showNotification } from '../../notification/notification-port.js';
import { ComponentEditorModalProvider } from '../save-component/ComponentEditorModalContext.js';
import { ScriptTaskChromeProvider } from './ScriptTaskChromeContext.js';
import {
  FlowEditorCanvasAndScriptResizableColumn,
  ScriptEditorPanel,
} from '../../modules/code-editor/layout/ScriptEditorPanel';
import { useTaskEditor } from './useTaskEditor';
import { TaskEditorPanel } from './TaskEditorPanel';
import { persistScriptTaskScriptFile } from './persistScriptTaskScriptFile.js';
import { deriveTaskStateKey, shouldPersistCacheAsideSourceMapping } from './taskScriptPersistence.js';
import { buildAtomicComponentJsonPath } from '../vnext-workspace/atomicComponentPaths.js';
import type { AtomicSavedInfo } from '../save-component/componentEditorModalTypes.js';

export interface TaskEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  registerToolbar?: HostDocumentToolbarSlot;
  layoutSurface?: 'panel' | 'modal';
  /** After save (e.g. modal): sync workflow refs from JSON top-level fields. */
  onAtomicSaved?: (info: AtomicSavedInfo) => void;
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}

export function TaskEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
  layoutSurface = 'panel',
  onAtomicSaved,
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

  const { save, saving, saveError, autoSavePending, autoSaved } = useSaveComponent({
    componentType: 'task',
    beforeSave,
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
      ? buildAtomicComponentJsonPath(activeProject.path, vnextConfig.paths, 'tasks', group, name)
      : null;
  const { loading, error, isReady } = useTaskEditor({ filePath });

  const scriptPanelOpen = useEditorPanelsStore((s) => s.scriptPanelOpen);
  const activeScript = useScriptPanelStore((s) => s.activeScript);
  const closeScript = useScriptPanelStore((s) => s.closeScript);
  const setScriptPanelOpen = useEditorPanelsStore((s) => s.setScriptPanelOpen);

  const componentDirectoryPath = useMemo(() => {
    if (!activeProject || !vnextConfig) return undefined;
    const base = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.tasks}`;
    return (group ? `${base}/${group}` : base)
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/');
  }, [activeProject, vnextConfig, group]);

  const { publish: publishFile, publishing, canPublish } = usePublish();
  const handlePublish = useCallback(() => {
    void publishFile(save, filePath);
  }, [publishFile, save, filePath]);

  useEffect(() => {
    return useScriptPanelStore.subscribe((state, prev) => {
      if (!state.activeScript?.value || state.activeScript.value === prev.activeScript?.value) return;
      const script = state.activeScript;

      // `useScriptPanelStore` is a global singleton and `TaskEditorView` can
      // stay mounted across in-app navigation between tasks (no remount key
      // on the route). Re-derive the CURRENTLY loaded task's key fresh from
      // the store on every fire (not from a render-scope closure, which
      // would go stale) and only persist when the edited script actually
      // belongs to this task — otherwise a script left open while switching
      // tasks would clobber an unrelated task's JSON.
      const { componentJson: currentJson, updateComponent: update } = useComponentStore.getState();
      const currentTaskStateKey = deriveTaskStateKey(currentJson);

      if (shouldPersistCacheAsideSourceMapping(script, currentTaskStateKey)) {
        update((draft) => {
          const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
          const cfg = (attrs.config ?? {}) as Record<string, unknown>;
          cfg.sourceMapping = script.value;
          attrs.config = cfg;
          draft.attributes = attrs;
        });
      }
    });
  }, []);

  // Defensive: when the loaded task actually changes (in-app navigation to
  // a different task without unmounting this view), close any still-open
  // script panel instead of leaving a stale Task-A script rendered over
  // Task B's editor. Skipped on initial mount (ref starts at null).
  const prevFilePathRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevFilePathRef.current !== null && prevFilePathRef.current !== filePath) {
      closeScript();
      setScriptPanelOpen(false);
    }
    prevFilePathRef.current = filePath;
  }, [filePath, closeScript, setScriptPanelOpen]);

  const content =
    loading || !isReady || !componentJson ? (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading task...'}
      </div>
    ) : (
      <FlowEditorCanvasAndScriptResizableColumn
        canvas={
          <ComponentEditorLayout
            registerToolbar={registerToolbar}
            surface={layoutSurface}
            isDirty={isDirty}
            hasSaved={!isDirty && undoStackLength > 0}
            saving={saving}
            saveErrorMessage={saveError?.toUserMessage().message ?? null}
            onSave={save}
            onUndo={undo}
            onRedo={redo}
            canUndo={undoStackLength > 0}
            canRedo={redoStackLength > 0}
            onPublish={canPublish ? handlePublish : undefined}
            publishing={publishing}
            autoSavePending={autoSavePending}
            autoSaved={autoSaved}>
            <TaskEditorPanel
              json={componentJson}
              onChange={updateComponent}
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
    <ScriptTaskChromeProvider
      onOpenScriptFileInHost={onOpenScriptFileInHost}
      scriptDirectoryPath={componentDirectoryPath}>
      <ComponentEditorModalProvider onOpenScriptFileInHost={onOpenScriptFileInHost}>
        {content}
      </ComponentEditorModalProvider>
    </ScriptTaskChromeProvider>
  );
}
