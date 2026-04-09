import { useMemo, useState } from 'react';
import { useWorkflowStore } from '@modules/canvas-interaction/WorkflowStore';
import { CsxEditorField, type ScriptCode } from '@modules/save-component/components/CsxEditorField';
import { SchemaReferenceField, type SchemaReference } from '@modules/save-component/components/SchemaReferenceField';
import { getLabels, getLabel, getTriggerLabel, getTriggerColor, getTriggerKindLabel } from './property-panel/Helpers';
import { Badge, SelectField, Section, InfoRow, IconPlus, IconTrash } from './property-panel/Shared';
import { ArrowRight, MousePointer2 } from 'lucide-react';

/* ────────────── Parse Edge ID ────────────── */

function parseEdgeId(edgeId: string): { sourceKey: string; transitionKey: string } | null {
  // Edge ID format: "stateKey->targetKey::transitionKey"  or "start->targetKey"
  const arrowIdx = edgeId.indexOf('->');
  const colonIdx = edgeId.indexOf('::');
  if (arrowIdx < 0) return null;
  const sourceKey = edgeId.substring(0, arrowIdx);
  const transitionKey = colonIdx >= 0 ? edgeId.substring(colonIdx + 2) : edgeId;
  return { sourceKey, transitionKey };
}

/* ────────────── MAIN COMPONENT ────────────── */

export function TransitionPropertyPanel() {
  const { workflowJson, selectedEdgeId, updateWorkflow } = useWorkflowStore();

  const parsed = useMemo(() => {
    if (!selectedEdgeId) return null;
    return parseEdgeId(selectedEdgeId);
  }, [selectedEdgeId]);

  const { state, transition, transitionIndex } = useMemo(() => {
    if (!workflowJson || !parsed) return { state: null, transition: null, transitionIndex: -1 };
    const attrs = (workflowJson as any).attributes;
    if (!attrs?.states) return { state: null, transition: null, transitionIndex: -1 };

    // Handle start transition
    if (parsed.sourceKey === '__start__' || parsed.sourceKey === 'start') {
      const st = attrs.startTransition || attrs.start;
      return { state: null, transition: st, transitionIndex: -1 };
    }

    const s = attrs.states.find((s: any) => s.key === parsed.sourceKey);
    if (!s?.transitions) return { state: s, transition: null, transitionIndex: -1 };
    const idx = s.transitions.findIndex((t: any) => t.key === parsed.transitionKey);
    return { state: s, transition: idx >= 0 ? s.transitions[idx] : null, transitionIndex: idx };
  }, [workflowJson, parsed]);

  const allStateKeys = useMemo(() => {
    const attrs = (workflowJson as any)?.attributes;
    return (attrs?.states || []).map((s: any) => s.key) as string[];
  }, [workflowJson]);

  if (!transition || !parsed) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-6">
          <div className="size-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
            <MousePointer2 size={24} />
          </div>
          <div className="text-[13px] text-slate-400 font-semibold">Select a transition</div>
          <div className="text-[11px] text-slate-300 mt-1">Click on an edge in the canvas</div>
        </div>
      </div>
    );
  }

  const isStartTransition = parsed.sourceKey === '__start__' || parsed.sourceKey === 'start';
  const target = transition.target || transition.to || '';
  const labels = getLabels(transition);
  const triggerKindLabel = getTriggerKindLabel(transition.triggerKind);

  const updateField = (field: string, value: any) => {
    if (isStartTransition) {
      updateWorkflow((draft: any) => {
        const st = draft.attributes?.startTransition || draft.attributes?.start;
        if (st) st[field] = value;
      });
    } else {
      updateWorkflow((draft: any) => {
        const s = draft.attributes?.states?.find((s: any) => s.key === parsed!.sourceKey);
        if (s?.transitions?.[transitionIndex]) {
          s.transitions[transitionIndex][field] = value;
        }
      });
    }
  };

  const updateScript = (scriptField: 'rule' | 'condition' | 'timer', script: ScriptCode) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === parsed!.sourceKey);
      if (!s?.transitions?.[transitionIndex]) return;
      s.transitions[transitionIndex][scriptField] = script;
      if (scriptField === 'rule') s.transitions[transitionIndex].condition = script;
      if (scriptField === 'condition') s.transitions[transitionIndex].rule = script;
    });
  };

  const removeScript = (scriptField: 'rule' | 'condition' | 'timer') => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === parsed!.sourceKey);
      if (!s?.transitions?.[transitionIndex]) return;
      delete s.transitions[transitionIndex][scriptField];
      if (scriptField === 'rule') delete s.transitions[transitionIndex].condition;
      if (scriptField === 'condition') delete s.transitions[transitionIndex].rule;
    });
  };

  /* Label editing */
  const addLabel = () => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === parsed!.sourceKey);
      const t = s?.transitions?.[transitionIndex];
      if (!t) return;
      if (!t.labels) t.labels = [];
      t.labels.push({ label: '', language: 'en' });
    });
  };

  const removeLabel = (index: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === parsed!.sourceKey);
      const t = s?.transitions?.[transitionIndex];
      t?.labels?.splice(index, 1);
    });
  };

  const updateLabelField = (index: number, field: string, value: string) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === parsed!.sourceKey);
      const t = s?.transitions?.[transitionIndex];
      if (t?.labels?.[index]) t.labels[index][field] = value;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <div className="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ArrowRight size={14} className="text-emerald-500" />
          </div>
          <span className="text-[14px] font-bold text-slate-900 truncate font-mono tracking-tight">{transition.key || 'transition'}</span>
        </div>
        <div className="flex items-center gap-2 ml-10">
          <Badge className={getTriggerColor(transition.triggerType ?? 0)}>{getTriggerLabel(transition.triggerType ?? 0)}</Badge>
          {triggerKindLabel && <Badge className="bg-slate-100 text-slate-500">{triggerKindLabel}</Badge>}
          <span className="text-[11px] text-slate-400">from <span className="font-mono font-semibold">{parsed.sourceKey}</span></span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Key */}
        {!isStartTransition && (
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Key</label>
            <input
              type="text"
              value={transition.key || ''}
              onChange={(e) => updateField('key', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>
        )}

        {/* Target */}
        <div>
          <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Target</label>
          <select
            value={target}
            onChange={(e) => updateField('target', e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200/80 rounded-lg bg-slate-50/50 text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all cursor-pointer"
          >
            <option value="$self">$self (current state)</option>
            {!allStateKeys.includes(target) && target && target !== '$self' && <option value={target}>{target}</option>}
            {allStateKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Trigger Type */}
        {!isStartTransition && (
          <>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Trigger Type</label>
              <SelectField
                value={transition.triggerType ?? 0}
                onChange={(v) => updateField('triggerType', Number(v))}
                options={[
                  { value: 0, label: 'Manual' }, { value: 1, label: 'Auto' },
                  { value: 2, label: 'Scheduled' }, { value: 3, label: 'Event' },
                ]}
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Trigger Kind</label>
              <SelectField
                value={transition.triggerKind ?? 0}
                onChange={(v) => {
                  const val = Number(v);
                  updateField('triggerKind', val === 0 ? undefined : val);
                }}
                options={[
                  { value: 0, label: 'Standard' }, { value: 10, label: 'Default / Fallback' },
                ]}
              />
            </div>
          </>
        )}

        {/* Version Strategy */}
        <div>
          <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Version Strategy</label>
          <SelectField
            value={transition.versionStrategy || 'Minor'}
            onChange={(v) => updateField('versionStrategy', v)}
            options={[
              { value: 'Minor', label: 'Minor' }, { value: 'Major', label: 'Major' },
            ]}
          />
        </div>

        {/* Schema */}
        {!isStartTransition && (
          <Section title="Schema" defaultOpen={!!transition.schema}>
            <SchemaReferenceField
              value={transition.schema}
              onChange={(ref) => updateField('schema', ref)}
            />
          </Section>
        )}

        {/* Labels */}
        {!isStartTransition && (
          <Section title="Labels" count={labels.length} defaultOpen>
            <div className="space-y-2">
              {labels.map((l: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={l.language}
                    onChange={(e) => updateLabelField(i, 'language', e.target.value)}
                    className="w-10 px-2 py-1.5 text-[11px] font-mono text-slate-500 border border-slate-200/80 rounded-lg bg-slate-100/80 text-center shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <input
                    type="text"
                    value={l.label}
                    onChange={(e) => updateLabelField(i, 'label', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
                  />
                  <button onClick={() => removeLabel(i)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                    <IconTrash />
                  </button>
                </div>
              ))}
              <button onClick={addLabel} className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 font-semibold mt-1">
                <IconPlus /> Add Label
              </button>
            </div>
          </Section>
        )}

        {/* Condition Script */}
        {!isStartTransition && (
          <Section title="Condition / Rule" defaultOpen={!!transition.rule}>
            <CsxEditorField
              value={transition.rule}
              onChange={(s) => updateScript('rule', s)}
              onRemove={() => removeScript('rule')}
              templateType="condition"
              contextName={`${parsed.sourceKey}-${transition.key || 'rule'}`}
              label="Condition"
              stateKey={parsed.sourceKey}
              listField="transitions"
              index={transitionIndex}
              scriptField="rule"
            />
          </Section>
        )}

        {/* Timer Script */}
        {!isStartTransition && (transition.triggerType === 2 || transition.timer) && (
          <Section title="Timer" defaultOpen={!!transition.timer}>
            <CsxEditorField
              value={transition.timer}
              onChange={(s) => updateScript('timer', s)}
              onRemove={() => removeScript('timer')}
              templateType="timer"
              contextName={`${parsed.sourceKey}-${transition.key || 'timer'}`}
              label="Timer"
              stateKey={parsed.sourceKey}
              listField="transitions"
              index={transitionIndex}
              scriptField="timer"
            />
          </Section>
        )}
      </div>
    </div>
  );
}
