import { useMemo } from 'react';
import { useWorkflowStore } from '../../../stores/workflow-store';
import { SchemaReferenceField, type SchemaReference } from '../../../components/SchemaReferenceField';
import { getLabels, getLabel, getTriggerLabel } from './helpers';
import { Badge, Section, InfoRow, SelectField } from './shared';
import { Play, Plus, Trash2 } from 'lucide-react';

export function StartNodePanel({ startTransition }: { startTransition: any }) {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const target = startTransition.target || startTransition.to || '';
  const schema = startTransition.schema;
  const labels = getLabels(startTransition);

  // All state keys for target dropdown
  const allStateKeys = useMemo(() => {
    const attrs = (workflowJson as any)?.attributes;
    return (attrs?.states || []).map((s: any) => s.key) as string[];
  }, [workflowJson]);

  const updateStartField = (field: string, value: any) => {
    updateWorkflow((draft: any) => {
      const st = draft.attributes?.startTransition || draft.attributes?.start;
      if (st) st[field] = value;
    });
  };

  const updateSchema = (ref: SchemaReference | null) => {
    updateWorkflow((draft: any) => {
      const st = draft.attributes?.startTransition || draft.attributes?.start;
      if (st) st.schema = ref;
    });
  };

  const addLabel = () => {
    updateWorkflow((draft: any) => {
      const st = draft.attributes?.startTransition || draft.attributes?.start;
      if (!st) return;
      if (!st.labels) st.labels = [];
      st.labels.push({ label: '', language: 'en' });
    });
  };

  const removeLabel = (index: number) => {
    updateWorkflow((draft: any) => {
      const st = draft.attributes?.startTransition || draft.attributes?.start;
      if (!st?.labels) return;
      st.labels.splice(index, 1);
    });
  };

  const updateLabel = (index: number, field: 'label' | 'language', value: string) => {
    updateWorkflow((draft: any) => {
      const st = draft.attributes?.startTransition || draft.attributes?.start;
      if (!st?.labels?.[index]) return;
      st.labels[index][field] = value;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3.5 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <div className="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Play size={14} className="text-emerald-500" />
          </div>
          <span className="text-[14px] font-bold text-slate-900 tracking-tight">Start Transition</span>
          <Badge className="bg-emerald-500/10 text-emerald-600">Entry Point</Badge>
        </div>
        {getLabel(startTransition) && (
          <div className="text-[12px] text-slate-500 ml-10">{getLabel(startTransition)}</div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <InfoRow label="Key" value={startTransition.key || 'start'} mono copyable />

        {/* Editable target */}
        <div>
          <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Target</label>
          <select
            value={target}
            onChange={(e) => updateStartField('target', e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200/80 rounded-lg bg-slate-50/50 text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all cursor-pointer"
          >
            {!allStateKeys.includes(target) && target && <option value={target}>{target}</option>}
            {allStateKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <InfoRow label="Trigger" value={getTriggerLabel(startTransition.triggerType ?? 0)} />

        {/* Editable version strategy */}
        <div>
          <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Version Strategy</label>
          <SelectField
            value={startTransition.versionStrategy || 'Minor'}
            onChange={(v) => updateStartField('versionStrategy', v)}
            options={[
              { value: 'Minor', label: 'Minor' }, { value: 'Major', label: 'Major' },
            ]}
          />
        </div>

        {/* Editable schema */}
        <Section title="Schema" defaultOpen>
          <SchemaReferenceField
            value={schema}
            onChange={updateSchema}
          />
        </Section>

        {/* Editable labels */}
        <Section title="Labels" count={labels.length} defaultOpen>
          <div className="space-y-2">
            {labels.map((l: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={l.language}
                  onChange={(e) => updateLabel(i, 'language', e.target.value)}
                  className="w-10 px-2 py-1.5 text-[11px] font-mono text-slate-500 border border-slate-200/80 rounded-lg bg-slate-100/80 text-center shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => updateLabel(i, 'label', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
                />
                <button onClick={() => removeLabel(i)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button onClick={addLabel} className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 font-semibold mt-1">
              <Plus size={13} /> Add Label
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
