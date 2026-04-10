import { useState, useMemo } from 'react';
import { useWorkflowStore } from '@app/store/WorkflowStore';
import { CsxEditorField, type ScriptCode } from '@modules/save-component/components/CsxEditorField';
import { SchemaReferenceField, type SchemaReference } from '@modules/save-component/components/SchemaReferenceField';
import { getLabels, getTriggerKindLabel } from './PropertyPanelHelpers';
import { Badge, IconPlus, IconTrash } from './PropertyPanelShared';
import { ArrowRight } from 'lucide-react';

/* ────────────── TRANSITIONS TAB ────────────── */

export function TransitionsTab({ state }: { state: any }) {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const transitions = state.transitions || [];
  const stateKey = state.key;

  const allStateKeys = useMemo(() => {
    const attrs = (workflowJson as any)?.attributes;
    return (attrs?.states || []).map((s: any) => s.key) as string[];
  }, [workflowJson]);

  const addTransition = () => {
    const otherKeys = allStateKeys.filter((k) => k !== stateKey);
    const target = otherKeys[0] || stateKey;
    const key = `${stateKey}-to-${target || 'new'}`;
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (!s.transitions) s.transitions = [];
      s.transitions.push({
        key,
        target,
        triggerType: 0,
        versionStrategy: 'Minor',
        labels: [{ label: key, language: 'en' }],
      });
    });
  };

  const removeTransition = (index: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.transitions) return;
      s.transitions.splice(index, 1);
    });
  };

  const updateTransition = (index: number, field: string, value: any) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.transitions?.[index]) return;
      s.transitions[index][field] = value;
    });
  };

  const updateTransitionScript = (index: number, scriptField: 'rule' | 'condition' | 'timer', script: ScriptCode) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.transitions?.[index]) return;
      s.transitions[index][scriptField] = script;
      // Backward compat: rule <-> condition
      if (scriptField === 'rule') {
        s.transitions[index].condition = script;
      } else if (scriptField === 'condition') {
        s.transitions[index].rule = script;
      }
    });
  };

  const removeTransitionScript = (index: number, scriptField: 'rule' | 'condition' | 'timer') => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.transitions?.[index]) return;
      delete s.transitions[index][scriptField];
      if (scriptField === 'rule') delete s.transitions[index].condition;
      if (scriptField === 'condition') delete s.transitions[index].rule;
    });
  };

  const updateTransitionSchema = (index: number, schema: SchemaReference | null) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.transitions?.[index]) return;
      s.transitions[index].schema = schema;
    });
  };

  return (
    <div className="space-y-2">
      {transitions.length === 0 ? (
        <div className="text-[12px] text-muted-foreground py-6 text-center">No transitions defined</div>
      ) : (
        transitions.map((t: any, i: number) => (
          <EditableTransitionCard
            key={`${t.key}-${i}`}
            transition={t}
            index={i}
            currentStateKey={stateKey}
            allStateKeys={allStateKeys}
            onUpdate={updateTransition}
            onRemove={removeTransition}
            onUpdateScript={updateTransitionScript}
            onRemoveScript={removeTransitionScript}
            onUpdateSchema={updateTransitionSchema}
          />
        ))
      )}
      <button onClick={addTransition} className="flex items-center gap-1.5 text-[11px] text-secondary-icon hover:text-secondary-foreground mt-1 font-semibold cursor-pointer">
        <IconPlus /> Add Transition
      </button>
    </div>
  );
}

/* ────────────── EDITABLE TRANSITION CARD ────────────── */

function EditableTransitionCard({ transition, index, currentStateKey, allStateKeys, onUpdate, onRemove, onUpdateScript, onRemoveScript, onUpdateSchema }: {
  transition: any; index: number; currentStateKey: string; allStateKeys: string[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  onUpdateScript: (index: number, scriptField: 'rule' | 'condition' | 'timer', script: ScriptCode) => void;
  onRemoveScript: (index: number, scriptField: 'rule' | 'condition' | 'timer') => void;
  onUpdateSchema: (index: number, schema: SchemaReference | null) => void;
}) {
  const [showSchema, setShowSchema] = useState(false);
  const target = transition.target || transition.to || '';
  const labels = getLabels(transition);
  const rule = transition.rule;
  const timer = transition.timer;
  const triggerKind = transition.triggerKind;
  const triggerKindLabel = getTriggerKindLabel(triggerKind);

  return (
    <div className="rounded-xl overflow-hidden bg-surface border border-border hover:border-muted-border-hover transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="px-3 py-2.5">
        {/* Header: key + badges + delete */}
        <div className="flex items-center gap-2 mb-2">
          <div className="size-6 rounded-lg bg-initial/10 flex items-center justify-center shrink-0">
            <ArrowRight size={12} className="text-initial" />
          </div>
          <input
            type="text"
            value={transition.key}
            onChange={(e) => onUpdate(index, 'key', e.target.value)}
            className="text-[12px] font-semibold text-foreground font-mono flex-1 min-w-0 bg-transparent border-none p-0 focus:outline-none focus:ring-0 tracking-tight"
          />
          {triggerKindLabel && (
            <Badge className="bg-muted text-muted-foreground">{triggerKindLabel}</Badge>
          )}
          <button onClick={() => onRemove(index)} className="p-1.5 text-subtle hover:text-destructive-text hover:bg-destructive-surface rounded-lg shrink-0 transition-all cursor-pointer">
            <IconTrash />
          </button>
        </div>

        {/* Target select */}
        <div className="flex items-center gap-2 ml-8 mb-2">
          <ArrowRight size={12} className="text-subtle shrink-0" />
          <select
            value={target}
            onChange={(e) => onUpdate(index, 'target', e.target.value)}
            className="text-xs text-secondary-icon font-mono bg-transparent border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border flex-1 cursor-pointer transition-all"
          >
            <option value="$self">$self (current state)</option>
            {!allStateKeys.includes(target) && target && target !== '$self' && (
              <option value={target}>{target}</option>
            )}
            {allStateKeys.map((k) => <option key={k} value={k}>{k}{k === currentStateKey ? ' (self)' : ''}</option>)}
          </select>
        </div>

        {/* Trigger type */}
        <div className="flex items-center gap-2 ml-8 mb-2">
          <span className="text-[10px] text-muted-foreground shrink-0 font-semibold">Trigger:</span>
          <select
            value={transition.triggerType ?? 0}
            onChange={(e) => onUpdate(index, 'triggerType', Number(e.target.value))}
            className="text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border cursor-pointer transition-all"
          >
            <option value={0}>Manual</option>
            <option value={1}>Auto</option>
            <option value={2}>Scheduled</option>
            <option value={3}>Event</option>
          </select>
        </div>

        {/* Trigger Kind */}
        <div className="flex items-center gap-2 ml-8 mb-1.5">
          <span className="text-[10px] text-muted-foreground shrink-0 font-semibold">Kind:</span>
          <select
            value={transition.triggerKind ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              onUpdate(index, 'triggerKind', v === 0 ? undefined : v);
            }}
            className="text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border cursor-pointer transition-all"
          >
            <option value={0}>Standard</option>
            <option value={10}>Default / Fallback</option>
          </select>
        </div>

        {/* Schema toggle */}
        <div className="ml-8 mt-2">
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="text-[10px] text-muted-foreground hover:text-primary-icon font-semibold transition-colors cursor-pointer"
          >
            {showSchema ? '▾ Schema' : '▸ Schema'}
          </button>
          {showSchema && (
            <div className="mt-1.5">
              <SchemaReferenceField
                value={transition.schema}
                onChange={(ref) => onUpdateSchema(index, ref)}
              />
            </div>
          )}
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="ml-8 mt-2 space-y-1">
            {labels.map((l: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-subtle w-4 shrink-0 font-mono text-center font-semibold">{l.language}</span>
                <span className="text-[11px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Condition/Rule Script Editor */}
      <CsxEditorField
        value={rule}
        onChange={(s) => onUpdateScript(index, 'rule', s)}
        onRemove={() => onRemoveScript(index, 'rule')}
        templateType="condition"
        contextName={`${currentStateKey}-${transition.key || 'rule'}`}
        label="Condition"
        stateKey={currentStateKey}
        listField="transitions"
        index={index}
        scriptField="rule"
      />

      {/* Timer Script Editor */}
      {(transition.triggerType === 2 || timer) && (
        <CsxEditorField
          value={timer}
          onChange={(s) => onUpdateScript(index, 'timer', s)}
          onRemove={() => onRemoveScript(index, 'timer')}
          templateType="timer"
          contextName={`${currentStateKey}-${transition.key || 'timer'}`}
          label="Timer"
          stateKey={currentStateKey}
          listField="transitions"
          index={index}
          scriptField="timer"
        />
      )}
    </div>
  );
}
