import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertCircle, ArrowLeft, ChevronRight, Loader2, Settings2 } from 'lucide-react';
import { useEditorPanelsStore } from '../../store/useEditorPanelsStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
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
import { Alert, AlertDescription, AlertTitle } from '../../ui/Alert';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';

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
}

export function FlowEditorView({ projectId, group, name, onNavigateBack }: FlowEditorViewProps) {
  const { workflowJson, diagramJson, selectedNodeId, selectedEdgeId, isDirty } = useWorkflowStore();
  const { activeProject } = useProjectStore();
  const { propertiesPanelOpen, scriptPanelOpen } = useEditorPanelsStore();
  const { activeScript } = useScriptPanelStore();
  const [showMetadata, setShowMetadata] = useState(false);

  const { loading, error } = useFlowEditorDocument({ group, name });
  const { saveError, saving } = useFlowEditorPersistence({ group, name });

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
          <Loader2 size={20} className="animate-spin text-muted-icon" />
        </div>
        <span className="text-[13px] font-medium text-muted-foreground">Loading workflow...</span>
      </div>
    );
  }

  if (error || !workflowJson || !diagramJson) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6">
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

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-surface/80 px-4 py-2.5 text-xs backdrop-blur-sm">
        {onNavigateBack ? (
          <button
            onClick={onNavigateBack}
            className="font-medium text-muted-foreground transition-colors hover:text-foreground">
            {activeProject?.domain || projectId}
          </button>
        ) : (
          <span className="font-medium text-muted-foreground">
            {activeProject?.domain || projectId}
          </span>
        )}
        <ChevronRight size={12} className="text-muted-foreground" />
        <span className="text-muted-foreground">Workflows</span>
        <ChevronRight size={12} className="text-muted-foreground" />
        <span className="font-semibold tracking-tight text-foreground">
          {group}/{name}
        </span>
        {isDirty && (
          <Badge variant="muted" className="ml-1.5" title="Unsaved changes">
            Modified
          </Badge>
        )}
        {saving && <span className="ml-2 text-muted-foreground">Saving...</span>}

        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className={`ml-auto rounded-xl p-1.5 transition-all duration-150 ${
            showMetadata
              ? 'border border-secondary-border bg-secondary-surface text-secondary-text'
              : 'border border-transparent text-muted-foreground hover:border-muted-border-hover hover:bg-muted hover:text-foreground'
          }`}
          title="Workflow Settings">
          <Settings2 size={16} />
        </button>
      </div>

      {showMetadata && <WorkflowMetadataPanel onClose={() => setShowMetadata(false)} />}
      {saveError && (
        <div className="border-b border-border-subtle px-4 py-3">
          <Alert variant="destructive">
            <AlertCircle size={14} className="shrink-0" />
            <AlertTitle>Unable to save workflow</AlertTitle>
            <AlertDescription>{saveError.toUserMessage().message}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <FlowEditorCanvasAndScriptResizableColumn
          canvas={
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {showSidePanel ? (
                <WorkflowPropertySidebarResizableRow
                  canvas={
                    <div className="relative h-full min-h-0 w-full">
                      <ReactFlowProvider>
                        <FlowCanvas workflowJson={workflowJson} diagramJson={diagramJson} />
                      </ReactFlowProvider>
                    </div>
                  }
                  sidePanel={
                    selectedNodeId ? <StatePropertyPanel /> : <TransitionPropertyPanel />
                  }
                />
              ) : (
                <div className="relative h-full min-h-0 flex-1">
                  <ReactFlowProvider>
                    <FlowCanvas workflowJson={workflowJson} diagramJson={diagramJson} />
                  </ReactFlowProvider>
                </div>
              )}
            </div>
          }
          scriptPanel={
            scriptPanelOpen && activeScript ? <ScriptEditorPanel /> : null
          }
        />
      </div>
    </div>
  );
}
