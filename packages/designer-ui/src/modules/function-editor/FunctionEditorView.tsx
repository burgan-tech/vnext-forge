import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HostDocumentToolbarSlot } from '../../modules/save-component/components/hostDocumentToolbarSlot';
import { useProjectStore } from '../../store/useProjectStore';
import { useComponentStore } from '../../store/useComponentStore';
import { useEditorPanelsStore } from '../../store/useEditorPanelsStore';
import { useRuntimeStore } from '../../store/useRuntimeStore';
import { useToolHeadersStore } from '../../store/useToolHeadersStore';
import { useScriptPanelStore } from '../../modules/code-editor/ScriptPanelStore';
import { useSaveComponent } from '../../modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import { usePublish } from '../../modules/save-component/PublishContext.js';
import {
  ComponentEditorModalProvider,
  useComponentEditorModalState,
} from '../save-component/ComponentEditorModalContext.js';
import { ScriptTaskChromeProvider } from '../task-editor/ScriptTaskChromeContext.js';
import {
  FlowEditorCanvasAndScriptResizableColumn,
  ScriptEditorPanel,
} from '../../modules/code-editor/layout/ScriptEditorPanel';
import { useFunctionEditor } from './UseFunctionEditor';
import { FunctionEditorPanel } from './components/FunctionEditorPanel';
import { toFunctionMetadataFormValues } from './FunctionEditorSchema.js';
import { FunctionRunShell } from '../function-run/FunctionRunShell.js';
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
 * Script-panel `listField` sentinel → the `attributes` key holding that
 * slot's rule entries.
 *
 * `ScriptEditorPanel` only knows how to write into the *workflow* store, so
 * the function editor bridges script edits into the component store by hand
 * (see the subscription below). Every slot that can own a script needs an
 * entry here, or its rule would be editable in the panel yet never reach
 * the document. Keep in sync with `FunctionContractSection`'s `SLOTS`.
 */
const CONTRACT_SLOT_BY_SCRIPT_LIST_FIELD: Record<string, string> = {
  functionInputView: 'inputView',
  functionOutputView: 'outputView',
  functionInputSchema: 'inputSchema',
  functionOutputSchema: 'outputSchema',
};

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
  const runtimeUrl = useRuntimeStore((s) => s.runtimeUrl);
  const toolWideHeaders = useToolHeadersStore((s) => s.headers);

  // `ComponentEditorDialog` exists to edit a component referenced from
  // elsewhere, not to run it — the modal surface never offers Run.
  const canRun = layoutSurface !== 'modal';
  const [runOpen, setRunOpen] = useState(false);

  // The Run panel and the script panel share the resizable column's second
  // slot (`FlowEditorCanvasAndScriptResizableColumn` only has two slots), so
  // they are made explicitly mutually exclusive rather than picking a silent
  // precedence: opening Run closes the script panel (below), and opening a
  // script closes Run (the subscription further down).
  const handleToggleRun = useCallback(() => {
    setRunOpen((prev) => {
      const next = !prev;
      if (next) {
        useEditorPanelsStore.getState().setScriptPanelOpen(false);
      }
      return next;
    });
  }, []);

  // Any script-open path (`CsxEditorField`, `TaskEditorView`, …) calls
  // `setScriptPanelOpen(true)` directly on the shared store, not through a
  // prop this view controls — so the other half of the exclusivity rule is
  // enforced by observing the store rather than by touching every call site.
  useEffect(() => {
    return useEditorPanelsStore.subscribe((state, prev) => {
      if (state.scriptPanelOpen && !prev.scriptPanelOpen) {
        setRunOpen(false);
      }
    });
  }, []);

  // Identity for the runner, read from the hand-editable JSON the same way
  // `FunctionMetadataForm` does: `attributes.scope` falls back to `scope`,
  // defaulting to `'I'` when neither is a recognized value.
  const functionIdentity = useMemo(() => {
    if (!componentJson) return null;
    const values = toFunctionMetadataFormValues(componentJson);
    if (!values.domain || !values.key) return null;
    return { domain: values.domain, functionKey: values.key, scope: values.scope };
  }, [componentJson]);

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
        return;
      }

      const contractSlot = CONTRACT_SLOT_BY_SCRIPT_LIST_FIELD[script.listField];
      if (contractSlot) {
        update((draft) => {
          const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
          const entries = attrs[contractSlot] as Record<string, unknown>[] | undefined;
          // Rules only exist in rule-based mode, i.e. when the slot holds an
          // array. A single-reference slot has nowhere to put a script.
          if (!Array.isArray(entries) || !entries[script.index]) return;
          entries[script.index][script.scriptField] = script.value;
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
            onToggleRun={canRun ? handleToggleRun : undefined}
            runOpen={runOpen}
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
          runOpen && canRun ? (
            functionIdentity ? (
              <FunctionRunShell
                domain={functionIdentity.domain}
                functionKey={functionIdentity.functionKey}
                scope={functionIdentity.scope}
                runtimeUrl={runtimeUrl}
                projectId={activeProject?.id}
                toolWideHeaders={toolWideHeaders}
                surface="panel"
              />
            ) : (
              <p className="text-muted-foreground p-4 text-sm">
                This function is missing a domain or key, so it cannot be run yet.
              </p>
            )
          ) : scriptPanelOpen && activeScript ? (
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
        <ModalCloseRestoreEffect />
        {content}
      </ComponentEditorModalProvider>
    </ScriptTaskChromeProvider>
  );
}
