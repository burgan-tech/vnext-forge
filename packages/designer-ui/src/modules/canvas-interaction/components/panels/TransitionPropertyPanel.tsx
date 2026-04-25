import { useMemo } from 'react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { CsxEditorField, type ScriptCode } from '../../../../modules/save-component/components/CsxEditorField';
import { SchemaReferenceField } from '../../../../modules/save-component/components/SchemaReferenceField';
import {
  getLabels,
  getTriggerLabel,
  getTriggerColor,
  getTriggerKindLabel,
} from './tabs/PropertyPanelHelpers';
import { Badge, SelectField, Section, IconPlus, IconTrash } from './tabs/PropertyPanelShared';
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
    if (!s?.transitions) return { state: null, transition: null, transitionIndex: -1 };
    const idx = s.transitions.findIndex((t: any) => t.key === parsed.transitionKey);
    return { state: null, transition: idx >= 0 ? s.transitions[idx] : null, transitionIndex: idx };
  }, [workflowJson, parsed]);

  const allStateKeys = useMemo(() => {
    const attrs = (workflowJson as any)?.attributes;
    return (attrs?.states || []).map((s: any) => s.key) as string[];
  }, [workflowJson]);

  if (!transition || !parsed) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="px-6 text-center">
          <div className="bg-muted text-subtle mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl">
            <MousePointer2 size={24} />
          </div>
          <div className="text-muted-foreground text-[13px] font-semibold">Select a transition</div>
          <div className="text-subtle mt-1 text-[11px]">Click on an edge in the canvas</div>
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border-subtle bg-surface border-b px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2">
          <div className="bg-initial/10 flex size-8 shrink-0 items-center justify-center rounded-xl">
            <ArrowRight size={14} className="text-initial" />
          </div>
          <span className="text-foreground truncate font-mono text-[14px] font-bold tracking-tight">
            {transition.key || 'transition'}
          </span>
        </div>
        <div className="ml-10 flex items-center gap-2">
          <Badge className={getTriggerColor(transition.triggerType ?? 0)}>
            {getTriggerLabel(transition.triggerType ?? 0)}
          </Badge>
          {triggerKindLabel && (
            <Badge className="bg-muted text-muted-foreground">{triggerKindLabel}</Badge>
          )}
          <span className="text-muted-foreground text-[11px]">
            from <span className="font-mono font-semibold">{parsed.sourceKey}</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Key */}
        {!isStartTransition && (
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
              Key
            </label>
            <input
              type="text"
              value={transition.key || ''}
              onChange={(e) => updateField('key', e.target.value)}
              className="border-border bg-muted-surface text-foreground focus:ring-ring/20 focus:border-primary-border focus:bg-surface w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-all focus:ring-2 focus:outline-none"
            />
          </div>
        )}

        {/* Target */}
        <div>
          <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
            Target
          </label>
          <select
            value={target}
            onChange={(e) => updateField('target', e.target.value)}
            className="border-border bg-muted-surface text-secondary-icon focus:ring-ring/20 focus:border-primary-border focus:bg-surface w-full cursor-pointer rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-all focus:ring-2 focus:outline-none">
            <option value="$self">$self (current state)</option>
            {!allStateKeys.includes(target) && target && target !== '$self' && (
              <option value={target}>{target}</option>
            )}
            {allStateKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {/* Trigger Type */}
        {!isStartTransition && (
          <>
            <div>
              <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
                Trigger Type
              </label>
              <SelectField
                value={transition.triggerType ?? 0}
                onChange={(v) => updateField('triggerType', Number(v))}
                options={[
                  { value: 0, label: 'Manual' },
                  { value: 1, label: 'Auto' },
                  { value: 2, label: 'Scheduled' },
                  { value: 3, label: 'Event' },
                ]}
              />
            </div>

            <div>
              <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
                Trigger Kind
              </label>
              <SelectField
                value={transition.triggerKind ?? 0}
                onChange={(v) => {
                  const val = Number(v);
                  updateField('triggerKind', val === 0 ? undefined : val);
                }}
                options={[
                  { value: 0, label: 'Standard' },
                  { value: 10, label: 'Default / Fallback' },
                ]}
              />
            </div>
          </>
        )}

        {/* Version Strategy */}
        <div>
          <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
            Version Strategy
          </label>
          <SelectField
            value={transition.versionStrategy || 'Minor'}
            onChange={(v) => updateField('versionStrategy', v)}
            options={[
              { value: 'Minor', label: 'Minor' },
              { value: 'Major', label: 'Major' },
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
                    className="text-muted-foreground border-border bg-muted focus:ring-ring/20 w-10 shrink-0 rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] focus:ring-2 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={l.label}
                    onChange={(e) => updateLabelField(i, 'label', e.target.value)}
                    className="border-border bg-muted-surface text-foreground focus:ring-ring/20 focus:border-primary-border focus:bg-surface flex-1 rounded-lg border px-2.5 py-1.5 text-xs transition-all focus:ring-2 focus:outline-none"
                  />
                  <button
                    onClick={() => removeLabel(i)}
                    className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all">
                    <IconTrash />
                  </button>
                </div>
              ))}
              <button
                onClick={addLabel}
                className="text-secondary-icon hover:text-secondary-foreground mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
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
