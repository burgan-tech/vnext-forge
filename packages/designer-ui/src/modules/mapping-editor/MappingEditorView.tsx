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
import { ScriptTaskChromeProvider } from '../../modules/task-editor/ScriptTaskChromeContext';
import { useMappingEditor } from './UseMappingEditor';
import { MappingEditorPanel } from './components/MappingEditorPanel';
import { buildAtomicComponentJsonPath } from '../vnext-workspace/atomicComponentPaths.js';
import type { AtomicSavedInfo } from '../save-component/componentEditorModalTypes.js';

export interface MappingEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  registerToolbar?: HostDocumentToolbarSlot;
  layoutSurface?: 'panel' | 'modal';
  onAtomicSaved?: (info: AtomicSavedInfo) => void;
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}

/**
 * Restores the parent component store snapshot when the modal editor
 * dialog transitions from open → closed. Mirrors the same effect in the
 * other component editors.
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

/**
 * Editor surface for `sys-mappings` components — a thin wrapper around
 * `MappingEditorPanel` reusing the same component store / save / publish
 * plumbing as Function / Extension editors. The lone script payload
 * lives at `attributes.{name,location,code,encoding}`; REF encoding is
 * NOT exposed here because a mapping cannot reference itself.
 */
export function MappingEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
  layoutSurface = 'panel',
  onAtomicSaved,
  onOpenScriptFileInHost,
}: MappingEditorViewProps) {
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
    componentType: 'mapping',
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
      ? buildAtomicComponentJsonPath(activeProject.path, vnextConfig.paths, 'mappings', group, name)
      : null;
  const { loading, error, mappingDocument } = useMappingEditor({ filePath });
  const isEditorReady = Boolean(
    mappingDocument && componentJson && componentFilePath === filePath,
  );

  const scriptPanelOpen = useEditorPanelsStore((s) => s.scriptPanelOpen);
  const activeScript = useScriptPanelStore((s) => s.activeScript);

  const mappingDirectoryPath = useMemo(() => {
    if (!activeProject || !vnextConfig) return undefined;
    const base = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.mappings}`;
    return (group ? `${base}/${group}` : base)
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/');
  }, [activeProject, vnextConfig, group]);

  const { publish: publishFile, publishing, canPublish } = usePublish();
  const handlePublish = useCallback(() => {
    void publishFile(save, filePath);
  }, [publishFile, save, filePath]);

  // Wire mapping body script changes from the bottom drawer back into
  // the component store (mirrors the function-editor's listener for the
  // single-file shape, but the only target is `attributes` directly).
  useEffect(() => {
    return useScriptPanelStore.subscribe((state, prev) => {
      if (!state.activeScript?.value || state.activeScript.value === prev.activeScript?.value) {
        return;
      }
      const script = state.activeScript;
      if (script.listField !== 'attributes') return;
      const { updateComponent: update } = useComponentStore.getState();
      update((draft) => {
        const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
        attrs.location = script.value.location ?? '';
        attrs.code = script.value.code ?? '';
        attrs.encoding = script.value.encoding === 'NAT' ? 'NAT' : 'B64';
        draft.attributes = attrs;
      });
    });
  }, []);

  const content =
    loading || !isEditorReady || !componentJson ? (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading mapping...'}
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
            <MappingEditorPanel json={componentJson} onChange={updateComponent} />
          </ComponentEditorLayout>
        }
        scriptPanel={
          scriptPanelOpen && activeScript ? (
            <ScriptEditorPanel
              workflowDirectoryPath={mappingDirectoryPath}
              onOpenScriptFileInHost={onOpenScriptFileInHost}
            />
          ) : null
        }
      />
    );

  return (
    <ScriptTaskChromeProvider
      onOpenScriptFileInHost={onOpenScriptFileInHost}
      scriptDirectoryPath={mappingDirectoryPath}>
      <ComponentEditorModalProvider onOpenScriptFileInHost={onOpenScriptFileInHost}>
        <ModalCloseRestoreEffect />
        {content}
      </ComponentEditorModalProvider>
    </ScriptTaskChromeProvider>
  );
}
