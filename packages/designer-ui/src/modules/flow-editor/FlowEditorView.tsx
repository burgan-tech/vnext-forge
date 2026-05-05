import { useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { PreviewDocumentDialog } from './components/PreviewDocumentDialog';
import { useEditorPanelsStore } from '../../store/useEditorPanelsStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import type { HostDocumentToolbarSlot } from '../../modules/save-component/components/hostDocumentToolbarSlot';
import { usePublish } from '../../modules/save-component/PublishContext.js';
import { FlowCanvas } from '../../modules/canvas-interaction/FlowCanvas';
import {
  StatePropertyPanel,
  WorkflowPropertySidebarResizableRow,
} from '../../modules/canvas-interaction/components/panels/StatePropertyPanel';
import { TransitionPropertyPanel } from '../../modules/canvas-interaction/components/panels/TransitionPropertyPanel';
import { WorkflowMetadataPanel } from '../../modules/canvas-interaction/components/panels/WorkflowMetadataPanel';
import {
  FlowEditorCanvasAndScriptResizableColumn,
  ScriptEditorPanel,
} from '../../modules/code-editor/layout/ScriptEditorPanel';
import { useScriptPanelStore } from '../../modules/code-editor/ScriptPanelStore';
import { useFlowEditorPersistence } from '../../modules/flow-editor/useFlowEditorPersistence';
import { useFlowEditorDocument } from '../../modules/flow-editor/useFlowEditorDocument';
import { FlowEditorSaveProvider } from '../../modules/flow-editor/FlowEditorSaveContext.js';
import { WorkflowValidationSync } from '../../modules/workflow-validation/WorkflowValidationSync.js';
import { Alert, AlertDescription, AlertTitle } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/Resizable.js';

const WORKFLOW_METADATA_RESIZE_PANEL_ID = 'workflow-metadata-resize';
const WORKFLOW_BODY_BELOW_METADATA_PANEL_ID = 'workflow-body-below-metadata';

/** Tahmini grup yüksekliği (viewport); default/min/max piksel ayarları buna göre. */
const WORKFLOW_METADATA_GROUP_HEIGHT_ESTIMATE_OFFSET = 80;

function getWorkflowMetadataVerticalResizeMetrics() {
  const H =
    typeof window !== 'undefined'
      ? Math.max(400, window.innerHeight - WORKFLOW_METADATA_GROUP_HEIGHT_ESTIMATE_OFFSET)
      : 720;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const minMetaPx = Math.round(H * 0.12) + 100;
  let maxMetaPx = Math.round(H * 0.78);
  maxMetaPx = Math.max(maxMetaPx, minMetaPx + 120);
  let defaultMetaPx = Math.round(H * 0.38) + 100;
  defaultMetaPx = Math.min(maxMetaPx, Math.max(minMetaPx, defaultMetaPx));
  const metaPct = r((100 * defaultMetaPx) / H);
  return {
    minMetaPx,
    maxMetaPx,
    defaultLayout: {
      [WORKFLOW_METADATA_RESIZE_PANEL_ID]: metaPct,
      [WORKFLOW_BODY_BELOW_METADATA_PANEL_ID]: r(100 - metaPct),
    } as const,
  };
}

export interface FlowEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  /**
   * Optional navigation callback wired by the host shell. The web SPA passes a
   * `useNavigate()` adapter; the VS Code extension webview omits it so the
   * editor stays router-agnostic.
   */
  onNavigateBack?: () => void;
  /**
   * Web shell: open workflow script (.csx) in full Monaco tab (same as task editor).
   * VS Code webview may omit.
   */
  onOpenScriptFileInHost?: (absolutePath: string) => void;
  /**
   * Web: sekme satırı sağı (`setToolbar`). VS Code webview: verilmez — panel üst şeridi `ComponentEditorLayout` içinde.
   */
  registerToolbar?: HostDocumentToolbarSlot;
  /**
   * Opens the QuickRun panel for this workflow. Wired by the host shell
   * (extension webview sends a postMessage command; web SPA may omit).
   */
  onOpenQuickRun?: () => void;
}

export function FlowEditorView({
  projectId: _projectId,
  group,
  name,
  onNavigateBack,
  onOpenScriptFileInHost,
  registerToolbar,
  onOpenQuickRun,
}: FlowEditorViewProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const workflowDirectoryPath = useMemo(() => {
    if (!activeProject || !vnextConfig) return undefined;
    const base = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.workflows}`;
    return (group ? `${base}/${group}` : base)
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/');
  }, [activeProject, vnextConfig, group]);

  const { workflowJson, diagramJson, selectedNodeId, selectedEdgeId, isDirty } = useWorkflowStore();
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const undoStackLength = useWorkflowStore((s) => s.undoStack.length);
  const redoStackLength = useWorkflowStore((s) => s.redoStack.length);
  const { propertiesPanelOpen, scriptPanelOpen } = useEditorPanelsStore();
  const { activeScript } = useScriptPanelStore();
  const [showMetadata, setShowMetadata] = useState(false);
  const [showPreviewDoc, setShowPreviewDoc] = useState(false);

  const workflowMetadataResizeMetrics = useMemo(
    () => getWorkflowMetadataVerticalResizeMetrics(),
    [],
  );

  const { loading, error } = useFlowEditorDocument({ group, name });
  const { save, saveError, saving } = useFlowEditorPersistence({ group, name });
  const handleSave = useCallback(() => {
    void save();
  }, [save]);

  const workflowFilePath = useMemo(() => {
    if (!workflowDirectoryPath) return null;
    return `${workflowDirectoryPath}/${name}.json`;
  }, [workflowDirectoryPath, name]);

  const { publish: publishFile, publishing, canPublish } = usePublish();
  const handlePublish = useCallback(() => {
    void publishFile(save, workflowFilePath);
  }, [publishFile, save, workflowFilePath]);

  if (loading) {
    return (
      <div className="bg-background flex h-full flex-col items-center justify-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-2xl">
          <Loader2 size={20} className="text-muted-icon animate-spin" />
        </div>
        <span className="text-muted-foreground text-[13px] font-medium">Loading workflow...</span>
      </div>
    );
  }

  if (error || !workflowJson || !diagramJson) {
    return (
      <div className="bg-background flex h-full flex-col items-center justify-center gap-4 px-6">
        <div className="w-full max-w-md">
          <Alert variant="destructive">
            <AlertCircle size={16} />
            <AlertTitle>Failed to load workflow</AlertTitle>
            <AlertDescription>
              {error?.toUserMessage().message || 'Failed to load workflow'}
            </AlertDescription>
          </Alert>
          {onNavigateBack && (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="outline" onClick={onNavigateBack}>
                <ArrowLeft size={14} />
                Back to project
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const showSidePanel = propertiesPanelOpen && (selectedNodeId || selectedEdgeId);

  const flowCanvasProps = {
    workflowJson,
    diagramJson,
    workflowSettingsActive: showMetadata,
    onToggleWorkflowSettings: () => setShowMetadata((v) => !v),
  } as const;

  const editorBody = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <FlowEditorCanvasAndScriptResizableColumn
        canvas={
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {showSidePanel ? (
              <WorkflowPropertySidebarResizableRow
                canvas={
                  <div className="relative h-full min-h-0 w-full">
                    <ReactFlowProvider>
                      <FlowCanvas {...flowCanvasProps} />
                    </ReactFlowProvider>
                  </div>
                }
                sidePanel={
                  selectedNodeId ? <StatePropertyPanel defaultTaskFolder={group} /> : <TransitionPropertyPanel />
                }
              />
            ) : (
              <div className="relative h-full min-h-0 flex-1">
                <ReactFlowProvider>
                  <FlowCanvas {...flowCanvasProps} />
                </ReactFlowProvider>
              </div>
            )}
          </div>
        }
        scriptPanel={
          scriptPanelOpen && activeScript ? (
            <ScriptEditorPanel
              workflowDirectoryPath={workflowDirectoryPath}
              onOpenScriptFileInHost={onOpenScriptFileInHost}
            />
          ) : null
        }
      />
    </div>
  );

  return (
    <FlowEditorSaveProvider saveWorkflow={save}>
      <WorkflowValidationSync />
      <ComponentEditorLayout
        canRedo={redoStackLength > 0}
        canUndo={undoStackLength > 0}
        hasSaved={!isDirty && undoStackLength > 0}
        isDirty={isDirty}
        onRedo={redo}
        onSave={handleSave}
        onUndo={undo}
        onPublish={canPublish ? handlePublish : undefined}
        publishing={publishing}
        onOpenQuickRun={onOpenQuickRun}
        onPreviewDocument={() => setShowPreviewDoc(true)}
        registerToolbar={registerToolbar}
        saveErrorMessage={saveError?.toUserMessage().message ?? null}
        saving={saving}>
        <div className="bg-background flex h-full min-h-0 min-w-0 flex-col">
        {showMetadata ? (
          <ResizablePanelGroup
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch overflow-hidden"
            defaultLayout={workflowMetadataResizeMetrics.defaultLayout}
            id="workflow-settings-vertical-resize"
            orientation="vertical">
            <ResizablePanel
              className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden"
              id={WORKFLOW_METADATA_RESIZE_PANEL_ID}
              maxSize={workflowMetadataResizeMetrics.maxMetaPx}
              minSize={workflowMetadataResizeMetrics.minMetaPx}>
              <WorkflowMetadataPanel onClose={() => setShowMetadata(false)} />
            </ResizablePanel>
            <ResizableHandle className="-mt-px box-border w-full max-w-none shrink-0 aria-[orientation=horizontal]:before:top-auto aria-[orientation=horizontal]:before:bottom-0" />
            <ResizablePanel
              className="flex min-h-0 min-w-0 flex-col overflow-hidden"
              id={WORKFLOW_BODY_BELOW_METADATA_PANEL_ID}
              minSize="22%">
              {editorBody}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{editorBody}</div>
        )}
        </div>
      </ComponentEditorLayout>
      <PreviewDocumentDialog
        open={showPreviewDoc}
        onOpenChange={setShowPreviewDoc}
        workflowJson={workflowJson}
      />
    </FlowEditorSaveProvider>
  );
}
