import { getLabels } from './PropertyPanelHelpers';
import { SelectField, Section, InfoRow, SummaryCard } from './PropertyPanelShared';
import { Trash2, Plus } from 'lucide-react';

export function GeneralTab({ state, updateWorkflow }: { state: any; updateWorkflow: any }) {
  const labels = getLabels(state);
  const stateKey = state.key;

  const updateField = (field: string, value: any) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (s) s[field] = value;
    });
  };

  const updateLabel = (index: number, text: string) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      const lbls = s.labels || s.label;
      if (lbls?.[index]) lbls[index].label = text;
    });
  };

  const addLabel = () => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (!s.labels) s.labels = [];
      s.labels.push({ label: '', language: 'en' });
    });
  };

  const removeLabel = (index: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      const lbls = s.labels || s.label;
      if (lbls) lbls.splice(index, 1);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">Key</label>
        <InfoRow label="" value={state.key} mono copyable />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">State Type</label>
        <SelectField
          value={state.stateType || 2}
          onChange={(v) => {
            const val = Number(v);
            updateField('stateType', val);
            if (val !== 3) updateField('subType', undefined);
          }}
          options={[
            { value: 1, label: 'Initial' }, { value: 2, label: 'Intermediate' },
            { value: 3, label: 'Final' }, { value: 4, label: 'SubFlow' }, { value: 5, label: 'Wizard' },
          ]}
        />
      </div>

      {(state.stateType === 3) && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">Sub Type</label>
          <SelectField
            value={state.subType || 0}
            onChange={(v) => updateField('subType', Number(v))}
            options={[
              { value: 0, label: 'None' }, { value: 1, label: 'Success' }, { value: 2, label: 'Error' },
              { value: 3, label: 'Terminated' }, { value: 4, label: 'Suspended' },
              { value: 5, label: 'Busy' }, { value: 6, label: 'Human' },
            ]}
          />
        </div>
      )}

      <div>
        <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">Version Strategy</label>
        <SelectField
          value={state.versionStrategy || 'Minor'}
          onChange={(v) => updateField('versionStrategy', v)}
          options={[
            { value: 'Minor', label: 'Minor' }, { value: 'Major', label: 'Major' }, { value: 'Patch', label: 'Patch' },
          ]}
        />
      </div>

      <Section title="Labels" count={labels.length} defaultOpen>
        <div className="space-y-2">
          {labels.map((l: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={l.language}
                onChange={(e) => {
                  updateWorkflow((draft: any) => {
                    const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
                    const lbls = s?.labels || s?.label;
                    if (lbls?.[i]) lbls[i].language = e.target.value;
                  });
                }}
                className="w-10 px-2 py-1.5 text-[11px] font-mono text-muted-foreground border border-border rounded-lg bg-muted text-center shrink-0 focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <input
                type="text"
                value={l.label}
                onChange={(e) => updateLabel(i, e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all"
              />
              <button onClick={() => removeLabel(i)} className="p-1 text-subtle hover:text-destructive-text hover:bg-destructive-surface rounded-lg transition-all cursor-pointer">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={addLabel} className="flex items-center gap-1.5 text-[11px] text-secondary-icon hover:text-secondary-foreground font-semibold mt-1 cursor-pointer">
            <Plus size={13} /> Add Label
          </button>
        </div>
      </Section>

      {/* Quick summary */}
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <div className="text-[10px] font-bold text-muted-foreground mb-3 tracking-widest uppercase">Summary</div>
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard label="Entry Tasks" value={state.onEntries?.length || 0} color="text-intermediate bg-intermediate/10" />
          <SummaryCard label="Exit Tasks" value={state.onExits?.length || 0} color="text-subflow bg-subflow/10" />
          <SummaryCard label="Transitions" value={state.transitions?.length || 0} color="text-initial bg-initial/10" />
        </div>
      </div>
    </div>
  );
}
