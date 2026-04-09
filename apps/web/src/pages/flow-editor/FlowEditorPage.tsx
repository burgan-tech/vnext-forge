import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertCircle, ArrowLeft, ChevronRight, Loader2, Settings2 } from 'lucide-react';

import { useUIStore } from '@app/store/UiStore';
import { FlowCanvas } from '@modules/canvas-interaction/canvas/FlowCanvas';
import { StatePropertyPanel } from '@modules/canvas-interaction/canvas/panels/StatePropertyPanel';
import { TransitionPropertyPanel } from '@modules/canvas-interaction/canvas/panels/TransitionPropertyPanel';
import { WorkflowMetadataPanel } from '@modules/canvas-interaction/canvas/panels/WorkflowMetadataPanel';
import { ScriptEditorPanel } from '@modules/code-editor/layout/ScriptEditorPanel';
import { useScriptPanelStore } from '@modules/code-editor/ScriptPanelStore';
import { useProjectStore } from '@modules/project-management/ProjectStore';
import { readFile } from '@modules/project-workspace/WorkspaceApi';
import { useSaveWorkflow } from '@modules/save-workflow/UseSaveWorkflow';
import { useWorkflowStore } from '@modules/canvas-interaction/WorkflowStore';

export function FlowEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const navigate = useNavigate();
  const { workflowJson, diagramJson, setWorkflow, selectedNodeId, selectedEdgeId, isDirty } = useWorkflowStore();
  const { activeProject, vnextConfig } = useProjectStore();
  const { propertiesPanelOpen, scriptPanelOpen } = useUIStore();
  const { activeScript } = useScriptPanelStore();
  useSaveWorkflow({ group: group || '', name: name || '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);

  useEffect(() => {
    if (!id || !group || !name) return;
    loadWorkflow();
  }, [id, group, name, activeProject, vnextConfig]);

  async function loadWorkflow() {
    if (!activeProject || !vnextConfig) return;
    setLoading(true);
    setError(null);
    try {
      const projectPath = activeProject.path;
      const componentsRoot = vnextConfig.paths.componentsRoot;
      const workflowsDir = vnextConfig.paths.workflows;

      const wfFilePath = `${projectPath}/${componentsRoot}/${workflowsDir}/${group}/${name}.json`;
      const diagFilePath = `${projectPath}/${componentsRoot}/${workflowsDir}/${group}/.meta/${name}.diagram.json`;

      const wfData = await readFile(wfFilePath);
      const workflow = typeof wfData.content === 'string' ? JSON.parse(wfData.content) : wfData.content;

      let diagram = { nodePos: {} };
      try {
        const diagData = await readFile(diagFilePath);
        diagram = typeof diagData.content === 'string' ? JSON.parse(diagData.content) : diagData.content;
      } catch {
        // No diagram file, use empty positions
      }

      setWorkflow(workflow, diagram);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-indigo-500/10">
          <Loader2 size={20} className="animate-spin text-indigo-500" />
        </div>
        <span className="text-[13px] font-medium text-slate-400">Loading workflow...</span>
      </div>
    );
  }

  if (error || !workflowJson || !diagramJson) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-500/10">
          <AlertCircle size={24} className="text-rose-500" />
        </div>
        <div className="text-[13px] font-semibold text-rose-500">{error || 'Failed to load workflow'}</div>
        <button
          onClick={() => navigate(`/project/${id}`)}
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft size={14} />
          Back to project
        </button>
      </div>
    );
  }

  const showSidePanel = propertiesPanelOpen && (selectedNodeId || selectedEdgeId);

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200/60 bg-white/80 px-4 py-2.5 text-xs backdrop-blur-sm">
        <button
          onClick={() => navigate(`/project/${id}`)}
          className="font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          {activeProject?.domain || id}
        </button>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="text-slate-400">Workflows</span>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="font-semibold tracking-tight text-slate-800">{group}/{name}</span>
        {isDirty && <span className="ml-1.5 size-2 animate-pulse rounded-full bg-amber-400" title="Unsaved changes" />}

        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className={`ml-auto rounded-xl p-1.5 transition-all duration-150 ${
            showMetadata
              ? 'bg-indigo-500/10 text-indigo-600'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
          title="Workflow Settings"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {showMetadata && <WorkflowMetadataPanel onClose={() => setShowMetadata(false)} />}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <div className="relative h-full flex-1">
            <ReactFlowProvider>
              <FlowCanvas workflowJson={workflowJson} diagramJson={diagramJson} />
            </ReactFlowProvider>
          </div>

          {showSidePanel && (
            <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-[-4px_0_16px_rgba(0,0,0,0.03)]">
              {selectedNodeId ? <StatePropertyPanel /> : <TransitionPropertyPanel />}
            </aside>
          )}
        </div>

        {scriptPanelOpen && activeScript && <ScriptEditorPanel />}
      </div>
    </div>
  );
}
