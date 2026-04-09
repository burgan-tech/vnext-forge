import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronRight, Settings2, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { FlowCanvas } from '../canvas/FlowCanvas';
import { StatePropertyPanel } from '../canvas/panels/StatePropertyPanel';
import { TransitionPropertyPanel } from '../canvas/panels/TransitionPropertyPanel';
import { WorkflowMetadataPanel } from '../canvas/panels/WorkflowMetadataPanel';
import { ScriptEditorPanel } from '../layout/ScriptEditorPanel';
import { useWorkflowStore } from '../stores/workflow-store';
import { useProjectStore } from '../stores/project-store';
import { useUIStore } from '@app/store/ui-store';
import { useScriptPanelStore } from '../stores/script-panel-store';
import { useSaveWorkflow } from '../hooks/useSaveWorkflow';

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

      const [wfRes, diagRes] = await Promise.all([
        fetch(`/api/files?path=${encodeURIComponent(wfFilePath)}`),
        fetch(`/api/files?path=${encodeURIComponent(diagFilePath)}`),
      ]);

      if (!wfRes.ok) throw new Error('Workflow file not found');

      const wfData = await wfRes.json();
      const workflow = typeof wfData.content === 'string' ? JSON.parse(wfData.content) : wfData.content;

      let diagram = { nodePos: {} };
      if (diagRes.ok) {
        try {
          const diagData = await diagRes.json();
          diagram = typeof diagData.content === 'string' ? JSON.parse(diagData.content) : diagData.content;
        } catch {
          // No diagram file, use empty positions
        }
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
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-slate-50">
        <div className="size-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
          <Loader2 size={20} className="text-indigo-500 animate-spin" />
        </div>
        <span className="text-[13px] text-slate-400 font-medium">Loading workflow...</span>
      </div>
    );
  }

  if (error || !workflowJson || !diagramJson) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-50">
        <div className="size-14 rounded-2xl bg-rose-500/10 flex items-center justify-center">
          <AlertCircle size={24} className="text-rose-500" />
        </div>
        <div className="text-[13px] text-rose-500 font-semibold">{error || 'Failed to load workflow'}</div>
        <button
          onClick={() => navigate(`/project/${id}`)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-all font-medium"
        >
          <ArrowLeft size={14} />
          Back to project
        </button>
      </div>
    );
  }

  const showSidePanel = propertiesPanelOpen && (selectedNodeId || selectedEdgeId);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Breadcrumb bar */}
      <div className="border-b border-slate-200/60 px-4 py-2.5 flex items-center gap-2 text-xs shrink-0 bg-white/80 backdrop-blur-sm">
        <button
          onClick={() => navigate(`/project/${id}`)}
          className="text-slate-400 hover:text-slate-700 font-medium transition-colors"
        >
          {activeProject?.domain || id}
        </button>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="text-slate-400">Workflows</span>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="font-semibold text-slate-800 tracking-tight">{group}/{name}</span>
        {isDirty && (
          <span className="ml-1.5 size-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />
        )}

        {/* Workflow metadata toggle */}
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className={`ml-auto p-1.5 rounded-xl transition-all duration-150 ${
            showMetadata
              ? 'bg-indigo-500/10 text-indigo-600'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
          title="Workflow Settings"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {/* Metadata panel (collapsible) */}
      {showMetadata && (
        <WorkflowMetadataPanel onClose={() => setShowMetadata(false)} />
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 h-full relative">
            <ReactFlowProvider>
              <FlowCanvas workflowJson={workflowJson} diagramJson={diagramJson} />
            </ReactFlowProvider>
          </div>

          {/* Right side panel */}
          {showSidePanel && (
            <aside className="w-[360px] border-l border-slate-200/60 overflow-y-auto shrink-0 bg-white/80 backdrop-blur-sm shadow-[-4px_0_16px_rgba(0,0,0,0.03)]">
              {selectedNodeId ? <StatePropertyPanel /> : <TransitionPropertyPanel />}
            </aside>
          )}
        </div>

        {/* Bottom script editor panel */}
        {scriptPanelOpen && activeScript && (
          <ScriptEditorPanel />
        )}
      </div>
    </div>
  );
}
