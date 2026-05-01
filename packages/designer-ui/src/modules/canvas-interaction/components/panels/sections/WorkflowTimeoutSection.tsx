import { useState } from 'react';
import { Plus, Clock, ChevronRight } from 'lucide-react';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { CsxEditorField, type ScriptCode } from '../../../../../modules/save-component/components/CsxEditorField';
import { MetadataSection } from './MetadataSection';
import { useStateOptions } from './useStateOptions';

const inputClass =
  'w-full px-2.5 py-1.5 text-xs font-mono border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle';

export function WorkflowTimeoutSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const timeout = attrs.timeout;
  const stateOptions = useStateOptions();
  const allStateKeys = stateOptions.map((s) => s.key);

  const [mappingOpen, setMappingOpen] = useState(false);

  const createTimeout = () => {
    updateWorkflow((draft: any) => {
      draft.attributes.timeout = {
        key: 'timeout',
        target: '',
        versionStrategy: 'Minor',
        timer: { reset: 'workflow-start', duration: 'PT24H' },
      };
    });
  };

  const removeTimeout = () => {
    updateWorkflow((draft: any) => {
      delete draft.attributes.timeout;
    });
  };

  const updateField = (field: string, value: any) => {
    updateWorkflow((draft: any) => {
      if (draft.attributes?.timeout) draft.attributes.timeout[field] = value;
    });
  };

  const updateTimerField = (field: string, value: string) => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes?.timeout) return;
      if (!draft.attributes.timeout.timer) draft.attributes.timeout.timer = {};
      draft.attributes.timeout.timer[field] = value;
    });
  };

  const updateMapping = (mapping: ScriptCode) => {
    updateWorkflow((draft: any) => {
      if (draft.attributes?.timeout) draft.attributes.timeout.mapping = mapping;
    });
  };

  const removeMapping = () => {
    updateWorkflow((draft: any) => {
      if (draft.attributes?.timeout) delete draft.attributes.timeout.mapping;
    });
  };

  const target = timeout?.target || '';

  return (
    <MetadataSection title="Timeout" icon={<Clock size={13} />} defaultOpen={!!timeout}>
      {timeout ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">
              Workflow Timeout
            </span>
            <button
              onClick={removeTimeout}
              className="text-destructive-text hover:text-destructive-icon cursor-pointer text-[11px] font-semibold">
              Remove
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold">Key</label>
              <input
                type="text"
                value={timeout.key || ''}
                onChange={(e) => updateField('key', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold">
                Target state
              </label>
              <select
                value={target}
                onChange={(e) => updateField('target', e.target.value)}
                className={inputClass + ' cursor-pointer'}
                aria-label="Target state">
                <option value="">Select a state…</option>
                {!allStateKeys.includes(target) && target && (
                  <option value={target}>{target}</option>
                )}
                {allStateKeys.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-muted-foreground text-[10px] font-semibold">
              Version Strategy
            </label>
            <select
              value={timeout.versionStrategy || 'Minor'}
              onChange={(e) => updateField('versionStrategy', e.target.value)}
              className={inputClass + ' cursor-pointer'}>
              <option value="None">None</option>
              <option value="Minor">Minor</option>
              <option value="Major">Major</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-[10px] font-semibold block">
              Timer
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-muted-foreground text-[9px] font-medium">Reset</label>
                <input
                  type="text"
                  value={timeout.timer?.reset || ''}
                  onChange={(e) => updateTimerField('reset', e.target.value)}
                  className={inputClass}
                  placeholder="workflow-start"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-[9px] font-medium">
                  Duration (ISO 8601)
                </label>
                <input
                  type="text"
                  value={timeout.timer?.duration || ''}
                  onChange={(e) => updateTimerField('duration', e.target.value)}
                  className={inputClass}
                  placeholder="PT24H"
                />
              </div>
            </div>
          </div>

          {/* Collapsible mapping section */}
          <div className="bg-surface rounded-xl overflow-hidden">
            <button
              onClick={() => setMappingOpen(!mappingOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-muted transition-colors cursor-pointer">
              <ChevronRight
                size={12}
                className={`text-muted-foreground transition-transform duration-150 ${mappingOpen ? 'rotate-90' : ''}`}
              />
              <span className="text-[11px] font-semibold text-muted-foreground">
                Mapping (optional)
              </span>
            </button>
            {mappingOpen && (
              <div className="px-3 pb-3 pt-1">
                <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                  Optional dynamic timeout mapping. Computes timeout duration at runtime.
                </p>
                <CsxEditorField
                  value={(timeout.mapping as ScriptCode | undefined) ?? null}
                  onChange={updateMapping}
                  onRemove={removeMapping}
                  templateType="mapping"
                  contextName={`timeout-${timeout.key || 'mapping'}`}
                  label="Timeout Mapping"
                  stateKey="__workflow__"
                  listField="timeout"
                  index={0}
                  scriptField="mapping"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Timeouts define automatic workflow advancement after a delay.
          </p>
          <button
            onClick={createTimeout}
            className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
            <Plus size={13} /> Create Timeout
          </button>
        </div>
      )}
    </MetadataSection>
  );
}
