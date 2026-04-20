import { useMemo } from 'react';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import {
  SchemaReferenceField,
  type SchemaReference,
} from '../../../../../modules/save-component/components/SchemaReferenceField';
import { getLabels, getLabel, getTriggerLabel } from './PropertyPanelHelpers';
import { Badge, Section, InfoRow, SelectField } from './PropertyPanelShared';
import { Play, Plus, Trash2 } from 'lucide-react';

export function StartNodePanel({ startTransition }: { startTransition: any }) {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const target = startTransition.target || startTransition.to || '';
  const schema = startTransition.schema;
  const labels = getLabels(startTransition);

  // All state keys for target dropdown
  const allStateKeys = useMemo(() => {
    type Attrs = { states?: Array<{ key: string }> };
    const attrs = workflowJson?.attributes as Attrs | undefined;
    return (attrs?.states || []).map((s) => s.key);
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
    <div className="flex h-full flex-col">
      <div className="border-border-subtle bg-surface border-b px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2">
          <div className="bg-initial/10 flex size-8 items-center justify-center rounded-xl">
            <Play size={14} className="text-initial" />
          </div>
          <span className="text-foreground text-[14px] font-bold tracking-tight">
            Start Transition
          </span>
          <Badge className="bg-initial/10 text-initial">Entry Point</Badge>
        </div>
        {getLabel(startTransition) && (
          <div className="text-muted-foreground ml-10 text-[12px]">{getLabel(startTransition)}</div>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <InfoRow label="Key" value={startTransition.key || 'start'} mono copyable />

        {/* Editable target */}
        <div>
          <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
            Target
          </label>
          <select
            value={target}
            onChange={(e) => updateStartField('target', e.target.value)}
            className="border-border bg-muted-surface text-secondary-icon focus:ring-ring/20 focus:border-primary-border focus:bg-surface w-full cursor-pointer rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-all focus:ring-2 focus:outline-none">
            {!allStateKeys.includes(target) && target && <option value={target}>{target}</option>}
            {allStateKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <InfoRow label="Trigger" value={getTriggerLabel(startTransition.triggerType ?? 0)} />

        {/* Editable version strategy */}
        <div>
          <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
            Version Strategy
          </label>
          <SelectField
            value={startTransition.versionStrategy || 'Minor'}
            onChange={(v) => updateStartField('versionStrategy', v)}
            options={[
              { value: 'Minor', label: 'Minor' },
              { value: 'Major', label: 'Major' },
            ]}
          />
        </div>

        {/* Editable schema */}
        <Section title="Schema" defaultOpen>
          <SchemaReferenceField value={schema} onChange={updateSchema} />
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
                  className="text-muted-foreground border-border bg-muted focus:ring-ring/20 w-10 shrink-0 rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] focus:ring-2 focus:outline-none"
                />
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => updateLabel(i, 'label', e.target.value)}
                  className="border-border bg-muted-surface text-foreground focus:ring-ring/20 focus:border-primary-border focus:bg-surface flex-1 rounded-lg border px-2.5 py-1.5 text-xs transition-all focus:ring-2 focus:outline-none"
                />
                <button
                  onClick={() => removeLabel(i)}
                  className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={addLabel}
              className="text-secondary-icon hover:text-secondary-foreground mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
              <Plus size={13} /> Add Label
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
