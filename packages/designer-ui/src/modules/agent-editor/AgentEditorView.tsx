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
import { useAgentEditor } from './UseAgentEditor';
import { AgentEditorPanel } from './components/AgentEditorPanel';
import { buildAtomicComponentJsonPath } from '../vnext-workspace/atomicComponentPaths.js';
import type { AtomicSavedInfo } from '../save-component/componentEditorModalTypes.js';

export interface AgentEditorViewProps {
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
 * Editor surface for `sys-agents` components (runtime 0.0.105) — a thin
 * wrapper around `AgentEditorPanel` reusing the component store / save /
 * publish plumbing of the other atomic editors. Tool scripts (kind 1
 * IMapping, kind 2 IToolHandler) are edited in the script drawer and written
 * back to `attributes.tools[i].binding.{mapping|code}`.
 */
export function AgentEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
  layoutSurface = 'panel',
  onAtomicSaved,
  onOpenScriptFileInHost,
}: AgentEditorViewProps) {
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
    componentType: 'agent',
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
      ? buildAtomicComponentJsonPath(activeProject.path, vnextConfig.paths, 'agents', group, name)
      : null;
  const { loading, error, agentDocument } = useAgentEditor({ filePath });
  const isEditorReady = Boolean(
    agentDocument && componentJson && componentFilePath === filePath,
  );

  const scriptPanelOpen = useEditorPanelsStore((s) => s.scriptPanelOpen);
  const activeScript = useScriptPanelStore((s) => s.activeScript);

  const agentDirectoryPath = useMemo(() => {
    if (!activeProject || !vnextConfig) return undefined;
    const base = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.agents ?? 'Agents'}`;
    return (group ? `${base}/${group}` : base)
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/');
  }, [activeProject, vnextConfig, group]);

  const { publish: publishFile, publishing, canPublish } = usePublish();
  const handlePublish = useCallback(() => {
    void publishFile(save, filePath);
  }, [publishFile, save, filePath]);

  // Tool scripts edited in the bottom drawer land back on their tool binding.
  useEffect(() => {
    return useScriptPanelStore.subscribe((state, prev) => {
      if (!state.activeScript?.value || state.activeScript.value === prev.activeScript?.value) {
        return;
      }
      const script = state.activeScript;
      if (script.listField !== 'tools') return;
      const member = script.scriptField === 'binding.mapping' ? 'mapping' : script.scriptField === 'binding.code' ? 'code' : null;
      if (!member) return;
      const { updateComponent: update } = useComponentStore.getState();
      update((draft) => {
        const attrs = draft.attributes as Record<string, unknown> | undefined;
        const tools = Array.isArray(attrs?.tools) ? (attrs.tools as Record<string, unknown>[]) : [];
        const tool = tools[script.index];
        if (!tool) return;
        const binding = (tool.binding && typeof tool.binding === 'object' ? tool.binding : {}) as Record<string, unknown>;
        binding[member] = {
          location: script.value.location ?? '',
          code: script.value.code ?? '',
          encoding: script.value.encoding === 'NAT' ? 'NAT' : 'B64',
        };
        tool.binding = binding;
      });
    });
  }, []);

  const content =
    loading || !isEditorReady || !componentJson ? (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading agent...'}
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
            <AgentEditorPanel json={componentJson} onChange={updateComponent} />
          </ComponentEditorLayout>
        }
        scriptPanel={
          scriptPanelOpen && activeScript ? (
            <ScriptEditorPanel
              workflowDirectoryPath={agentDirectoryPath}
              onOpenScriptFileInHost={onOpenScriptFileInHost}
            />
          ) : null
        }
      />
    );

  return (
    <ScriptTaskChromeProvider
      onOpenScriptFileInHost={onOpenScriptFileInHost}
      scriptDirectoryPath={agentDirectoryPath}>
      <ComponentEditorModalProvider onOpenScriptFileInHost={onOpenScriptFileInHost}>
        <ModalCloseRestoreEffect />
        {content}
      </ComponentEditorModalProvider>
    </ScriptTaskChromeProvider>
  );
}
