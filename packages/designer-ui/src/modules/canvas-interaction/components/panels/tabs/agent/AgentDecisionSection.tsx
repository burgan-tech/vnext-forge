import { useMemo } from 'react';
import { GitBranch } from 'lucide-react';
import { resolveAgentCandidates, TriggerType } from '@vnext-forge-studio/vnext-types';

import { CsxEditorField, type ScriptCode } from '../../../../../save-component/components/CsxEditorField';
import { Section } from '../PropertyPanelShared';
import { Hint, SelectBox, TextAreaField, ToggleField } from '../../../../../agent-editor/components/agentFormPrimitives';
import { isRecord, type Json } from '../../../../../agent-editor/agentDocument';
import { setOrDelete } from './agentStateDocument';

const WHEN_SOURCE_LABEL: Record<string, string> = {
  hint: 'hint',
  description: 'description',
  label: 'label',
  key: 'key',
  hintsMapping: 'hints mapping',
};

function scriptOf(value: unknown): ScriptCode | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null;
  return {
    location: typeof value.location === 'string' ? value.location : '',
    code: value.code,
    encoding: value.encoding === 'NAT' ? 'NAT' : 'B64',
  };
}

/**
 * Decision editor of an AI Agent state: mode, reserved exits (fallback,
 * onApprovalRequest, onExhausted), exclusions, per-candidate hints and the
 * C# decision / hint mappings, with the candidate set the runtime will offer
 * the model (rule-less automatic transitions minus reserved exits and
 * `exclude`).
 */
export function AgentDecisionSection({
  state,
  onEditDecision,
}: {
  state: Json & { key: string };
  onEditDecision: (fn: (decision: Json) => void) => void;
}) {
  const agent = isRecord(state.agent) ? state.agent : {};
  const decision = isRecord(agent.decision) ? agent.decision : {};
  const transitions = Array.isArray(state.transitions) ? (state.transitions as Json[]) : [];
  const set = useMemo(() => resolveAgentCandidates(state), [state]);
  const mode = typeof decision.mode === 'string' ? decision.mode : 'model';
  const hints = isRecord(decision.hints) ? (decision.hints as Record<string, string>) : {};
  const exclude = Array.isArray(decision.exclude) ? (decision.exclude as string[]) : [];

  // Reserved exits must be rule-less automatic transitions of this state; they may target any state.
  const exitOptions = transitions
    .filter((t) => t.triggerType === TriggerType.Automatic && t.rule == null && typeof t.key === 'string')
    .map((t) => ({ value: String(t.key), label: `${String(t.key)} → ${typeof t.target === 'string' ? t.target : '?'}` }));
  const ruleLess = transitions.filter(
    (t) =>
      t.triggerType === TriggerType.Automatic &&
      t.rule == null &&
      t.triggerKind !== 10 &&
      ![decision.fallback, decision.onApprovalRequest, decision.onExhausted].includes(t.key),
  );

  const setMember = (key: string, value: unknown) => onEditDecision((d) => setOrDelete(d, key, value));

  return (
    <Section title="Decision" icon={<GitBranch size={13} />} count={set.candidates.length} defaultOpen>
      <Hint>
        Candidates are this state’s automatic transitions without a rule, minus the reserved exits and the excluded ones. A
        transition with a rule keeps it (mixed mode).
      </Hint>
      <div className="grid grid-cols-2 gap-2">
        <SelectBox
          label="Mode"
          value={mode}
          onChange={(v) =>
            onEditDecision((d) => {
              d.mode = v ?? 'model';
            })
          }
          options={[
            { value: 'model', label: 'Model — the model chooses' },
            { value: 'rules', label: 'Rules — transition rules choose' },
            { value: 'script', label: 'Script — a C# mapping chooses' },
          ]}
        />
        <SelectBox
          label="Fallback (required)"
          hint="Taken when the run fails, times out, exceeds a budget or returns a non-candidate."
          value={typeof decision.fallback === 'string' && decision.fallback ? decision.fallback : undefined}
          onChange={(v) =>
            onEditDecision((d) => {
              d.fallback = v ?? '';
            })
          }
          emptyLabel="Choose a transition…"
          options={exitOptions}
        />
        <SelectBox
          label="On approval request"
          hint="Taken when a tool needs human approval; it may target any state. Without it the fallback is taken."
          value={typeof decision.onApprovalRequest === 'string' ? decision.onApprovalRequest : undefined}
          onChange={(v) => setMember('onApprovalRequest', v)}
          emptyLabel="Not set"
          options={exitOptions}
        />
        <SelectBox
          label="On exhausted"
          hint="Taken without a provider call once policy.maxEntries is reached."
          value={typeof decision.onExhausted === 'string' ? decision.onExhausted : undefined}
          onChange={(v) => setMember('onExhausted', v)}
          emptyLabel="Not set"
          options={exitOptions}
        />
      </div>
      {exitOptions.length === 0 && (
        <p className="text-warning-text mt-1 text-[10px]">
          Add automatic transitions without a rule on the Transitions tab; reserved exits and candidates come from them.
        </p>
      )}

      {ruleLess.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wide">Excluded from the candidate set</div>
          {ruleLess.map((t) => {
            const key = String(t.key);
            return (
              <ToggleField
                key={key}
                label={key}
                checked={exclude.includes(key)}
                onChange={(on) =>
                  setMember('exclude', on ? [...exclude.filter((k) => k !== key), key] : exclude.filter((k) => k !== key))
                }
              />
            );
          })}
        </div>
      )}

      {/* Live candidate preview */}
      <div className="border-border-subtle bg-muted-surface mt-3 space-y-1.5 rounded-lg border p-2">
        <div className="text-muted-foreground text-[10px] font-semibold tracking-wide">
          Candidate set ({set.candidates.length})
        </div>
        {set.candidates.length === 0 && (
          <p className="text-subtle text-[10px]">
            {mode === 'rules' ? 'None — in rules mode every automatic transition carries a rule.' : 'No candidates yet.'}
          </p>
        )}
        {set.candidates.map((c) => (
          <div key={c.key} className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-mono font-semibold">{c.key}</span>
              <span className="text-subtle">→ {c.target ?? '?'}</span>
              <span className="bg-muted text-muted-foreground ml-auto rounded px-1 text-[9px] uppercase">
                {WHEN_SOURCE_LABEL[c.whenSource] ?? c.whenSource}
              </span>
            </div>
            {mode === 'model' ? (
              <TextAreaField
                label={`Hint for ${c.key}`}
                hint={hints[c.key] ? undefined : `Model sees: “${c.when}”`}
                value={hints[c.key]}
                rows={1}
                onChange={(v) =>
                  onEditDecision((d) => {
                    const next = { ...(isRecord(d.hints) ? (d.hints as Record<string, string>) : {}) };
                    if (v === undefined) delete next[c.key];
                    else next[c.key] = v;
                    setOrDelete(d, 'hints', next);
                  })
                }
              />
            ) : (
              <p className="text-subtle text-[10px]">“{c.when}”</p>
            )}
          </div>
        ))}
        {set.reserved.length > 0 && (
          <div className="border-border-subtle border-t pt-1.5">
            {set.reserved.map((r) => (
              <div key={`${r.role}-${r.key}`} className="flex items-center gap-1.5 text-[11px]">
                <span className="font-mono">{r.key}</span>
                <span className="text-subtle">→ {r.target ?? '?'}</span>
                <span className="ml-auto rounded bg-amber-500/10 px-1 text-[9px] uppercase text-amber-700">{r.role}</span>
              </div>
            ))}
          </div>
        )}
        {set.ruled.length > 0 && (
          <p className="text-subtle text-[10px]">Keep their own rule: {set.ruled.join(', ')}</p>
        )}
        {set.excluded.length > 0 && <p className="text-subtle text-[10px]">Excluded: {set.excluded.join(', ')}</p>}
        {Object.keys(hints).some((k) => !set.candidates.some((c) => c.key === k)) && (
          <p className="text-destructive-text text-[10px]">
            Hints for non-candidates are rejected at publish:{' '}
            {Object.keys(hints)
              .filter((k) => !set.candidates.some((c) => c.key === k))
              .join(', ')}
          </p>
        )}
      </div>

      {mode === 'script' && (
        <div className="mt-3">
          <CsxEditorField
            value={scriptOf(decision.mapping)}
            onChange={(next) =>
              onEditDecision((d) => {
                d.mapping = next;
              })
            }
            onRemove={() => onEditDecision((d) => setOrDelete(d, 'mapping', undefined))}
            templateType="agentDecision"
            contextName={`${state.key}-decision`}
            label="IAgentDecisionMapping (required)"
            stateKey={state.key}
            listField="agent"
            index={0}
            scriptField="decision.mapping"
            allowRefEncoding={false}
          />
        </div>
      )}
      {mode === 'model' && (
        <div className="mt-3">
          <CsxEditorField
            value={scriptOf(decision.hintsMapping)}
            onChange={(next) =>
              onEditDecision((d) => {
                d.hintsMapping = next;
              })
            }
            onRemove={() => onEditDecision((d) => setOrDelete(d, 'hintsMapping', undefined))}
            templateType="agentHints"
            contextName={`${state.key}-hints`}
            label="IAgentDecisionHintMapping (optional)"
            stateKey={state.key}
            listField="agent"
            index={0}
            scriptField="decision.hintsMapping"
            allowRefEncoding={false}
          />
        </div>
      )}
    </Section>
  );
}
