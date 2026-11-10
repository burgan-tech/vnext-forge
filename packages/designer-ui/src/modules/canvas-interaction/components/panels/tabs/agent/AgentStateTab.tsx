import { useCallback, useMemo, useState } from 'react';
import { Bot, FlaskConical } from 'lucide-react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { SYS_AGENTS_FLOW, validateAiAgentStates } from '@vnext-forge-studio/vnext-types';

import { useWorkflowStore } from '../../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../../store/useProjectStore';
import { CsxEditorField, type ScriptCode } from '../../../../../save-component/components/CsxEditorField';
import { ChooseExistingVnextComponentDialog } from '../ChooseExistingTaskDialog';
import { Section } from '../PropertyPanelShared';
import {
  AddButton,
  ChipsField,
  Hint,
  IssueList,
  RemoveButton,
  SelectBox,
  TextAreaField,
  TextField,
} from '../../../../../agent-editor/components/agentFormPrimitives';
import { AgentMemoryFields, AgentPolicyFields } from '../../../../../agent-editor/components/AgentSettingsFields';
import { exposedToolNames, isRecord, type Json } from '../../../../../agent-editor/agentDocument';
import { useAgentCatalog } from '../../../../../agent-editor/useAgentCatalog';
import { AgentDryRunDialog } from '../../../../../agent-runs/AgentDryRunDialog';
import { setOrDelete, updateAgentBinding, updateAgentSection } from './agentStateDocument';
import { AgentDecisionSection } from './AgentDecisionSection';

interface AgentStateTabProps {
  state: Json & { key: string };
}

type PickerTarget = { kind: 'lead' } | { kind: 'participant'; index: number } | null;

const TEAM_MODES = [
  { value: 'single', label: 'Single — only the agent runs' },
  { value: 'sequential', label: 'Sequential — participants in order, then the lead' },
  { value: 'concurrent', label: 'Concurrent — participants in parallel, then the lead' },
  { value: 'handoff', label: 'Handoff — the lead routes to one participant' },
];

const ROLES = [
  { value: 'system', label: 'system' },
  { value: 'user', label: 'user' },
  { value: 'assistant', label: 'assistant' },
];

function refLabel(ref: unknown): string {
  if (!isRecord(ref) || typeof ref.key !== 'string' || !ref.key) return 'No agent selected';
  return `${ref.key}${typeof ref.version === 'string' ? `@${ref.version}` : ''}`;
}

/**
 * Editor for the `agent` block of an AI Agent state (`stateType: 6`,
 * runtime 0.0.105): agent reference, team, prompt, output, memory override,
 * tool exclusion, policy narrowing and the decision with a live preview of
 * its candidate set.
 */
export function AgentStateTab({ state }: AgentStateTabProps) {
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow);
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const stateKey = state.key;

  const agent = isRecord(state.agent) ? state.agent : {};
  const prompt = isRecord(agent.prompt) ? agent.prompt : {};
  const leadKey = isRecord(agent.agent) && typeof agent.agent.key === 'string' ? agent.agent.key : undefined;
  const { agents, selected } = useAgentCatalog(activeProject?.id, leadKey);

  const [picker, setPicker] = useState<PickerTarget>(null);
  const [dryRunOpen, setDryRunOpen] = useState(false);

  const issues = useMemo(
    () => validateAiAgentStates([state]).map((i) => i.message),
    [state],
  );

  const edit = useCallback(
    (fn: (agent: Json, state: Json) => void) => updateWorkflow((draft) => updateAgentBinding(draft, stateKey, fn)),
    [updateWorkflow, stateKey],
  );
  const editSection = useCallback(
    (section: 'prompt' | 'decision' | 'memory' | 'policy' | 'tools' | 'output', fn: (s: Json) => void) =>
      updateWorkflow((draft) => updateAgentSection(draft, stateKey, section, fn)),
    [updateWorkflow, stateKey],
  );

  const handlePick = useCallback(
    (component: DiscoveredVnextComponent) => {
      const ref = {
        key: component.key,
        domain: component.domain ?? projectDomain,
        flow: SYS_AGENTS_FLOW,
        version: component.version ?? '1.0.0',
      };
      const target = picker;
      edit((a) => {
        if (target?.kind === 'participant') {
          const list = Array.isArray(a.agents) ? (a.agents as Json[]) : [];
          if (list[target.index]) list[target.index].agent = ref;
          a.agents = list;
        } else {
          a.agent = ref;
        }
      });
    },
    [edit, picker, projectDomain],
  );

  const mode = typeof agent.mode === 'string' ? agent.mode : 'single';
  const participants = Array.isArray(agent.agents) ? (agent.agents as Json[]) : [];
  const usesPromptMapping = typeof prompt.code === 'string' && prompt.code !== '';
  const [promptKind, setPromptKind] = useState<'template' | 'mapping'>(usesPromptMapping ? 'mapping' : 'template');
  const messages = Array.isArray(prompt.messages) ? (prompt.messages as Json[]) : [];
  const context = isRecord(prompt.context) ? (prompt.context as Record<string, string>) : {};
  const excludedTools = Array.isArray((agent.tools as Json | undefined)?.exclude)
    ? ((agent.tools as Json).exclude as string[])
    : [];
  const toolSuggestions = selected ? exposedToolNames(selected.json) : [];

  const promptScript: ScriptCode | null = usesPromptMapping
    ? {
        location: typeof prompt.location === 'string' ? prompt.location : '',
        code: String(prompt.code),
        encoding: prompt.encoding === 'NAT' ? 'NAT' : 'B64',
      }
    : null;

  return (
    <div className="space-y-3">
      <IssueList issues={issues} />

      {/* Agent reference */}
      <Section title="Agent" icon={<Bot size={13} />} defaultOpen>
        <Hint>The sys-agents component that runs when the instance enters this state (the lead when a team is set).</Hint>
        <div className="flex items-center gap-2">
          <div className="border-border bg-muted-surface min-w-0 flex-1 truncate rounded-lg border px-2.5 py-1.5 font-mono text-xs">
            {refLabel(agent.agent)}
          </div>
          <button
            type="button"
            onClick={() => setPicker({ kind: 'lead' })}
            disabled={!activeProject}
            className="border-border hover:bg-muted cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50">
            Choose…
          </button>
          <button
            type="button"
            onClick={() => setDryRunOpen(true)}
            disabled={!leadKey}
            title="Run the agent once against sample data (runtime dry-run, stub tools)"
            className="border-border hover:bg-muted flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50">
            <FlaskConical size={12} /> Dry run
          </button>
        </div>
        {leadKey && !agents.some((a) => a.key === leadKey) && agents.length > 0 && (
          <p className="text-warning-text mt-1 text-[10px]">This agent is not in the project; it may come from a dependency.</p>
        )}
      </Section>

      {/* Team */}
      <Section title="Team" count={participants.length} defaultOpen={participants.length > 0}>
        <SelectBox
          label="Mode"
          value={mode}
          options={TEAM_MODES}
          onChange={(v) =>
            edit((a) => {
              const next = v ?? 'single';
              if (next === 'single') {
                delete a.mode;
                delete a.agents;
              } else {
                a.mode = next;
                if (!Array.isArray(a.agents) || a.agents.length === 0) {
                  a.agents = [{ name: '', agent: { key: '', domain: projectDomain, flow: SYS_AGENTS_FLOW, version: '1.0.0' } }];
                }
              }
            })
          }
        />
        {mode !== 'single' && (
          <div className="mt-2 space-y-2">
            {participants.map((p, index) => (
              <div key={index} className="border-border-subtle space-y-1.5 rounded-lg border p-2">
                <div className="flex items-end gap-1.5">
                  <div className="flex-1">
                    <TextField
                      label="Name"
                      value={typeof p.name === 'string' ? p.name : ''}
                      onChange={(v) =>
                        edit((a) => {
                          (a.agents as Json[])[index].name = v ?? '';
                        })
                      }
                      mono
                      placeholder="cards"
                    />
                  </div>
                  <RemoveButton
                    label={`Remove participant ${index + 1}`}
                    onClick={() =>
                      edit((a) => {
                        (a.agents as Json[]).splice(index, 1);
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-muted-surface border-border min-w-0 flex-1 truncate rounded-lg border px-2.5 py-1 font-mono text-[11px]">
                    {refLabel(p.agent)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPicker({ kind: 'participant', index })}
                    disabled={!activeProject}
                    className="border-border hover:bg-muted cursor-pointer rounded-lg border px-2 py-1 text-[11px] disabled:opacity-50">
                    Choose…
                  </button>
                </div>
                <TextField
                  label="Description"
                  hint={mode === 'handoff' ? 'What the lead is told this participant is for.' : undefined}
                  value={typeof p.description === 'string' ? p.description : undefined}
                  onChange={(v) =>
                    edit((a) => {
                      setOrDelete((a.agents as Json[])[index], 'description', v);
                    })
                  }
                />
              </div>
            ))}
            <AddButton
              label="Add participant"
              onClick={() =>
                edit((a) => {
                  const list = Array.isArray(a.agents) ? (a.agents as Json[]) : [];
                  list.push({ name: '', agent: { key: '', domain: projectDomain, flow: SYS_AGENTS_FLOW, version: '1.0.0' } });
                  a.agents = list;
                })
              }
            />
          </div>
        )}
      </Section>

      {/* Prompt */}
      <Section title="Prompt" defaultOpen>
        <div className="mb-2 flex gap-1">
          {(['template', 'mapping'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setPromptKind(kind);
                editSection('prompt', (p) => {
                  if (kind === 'template') {
                    delete p.location;
                    delete p.code;
                    delete p.encoding;
                    if (typeof p.template !== 'string') p.template = '';
                  } else {
                    delete p.template;
                  }
                });
              }}
              className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium ${
                promptKind === kind ? 'bg-secondary-muted text-secondary-icon' : 'text-muted-foreground hover:bg-muted'
              }`}>
              {kind === 'template' ? 'Template' : 'C# prompt mapping'}
            </button>
          ))}
        </div>
        {promptKind === 'template' ? (
          <TextAreaField
            label="Template"
            hint={
              <>
                Placeholders: <code>{'{{ data.* }}'}</code>, <code>{'{{ body.* }}'}</code>, <code>{'{{ instance.id }}'}</code>,{' '}
                <code>{'{{ instance.key }}'}</code>, <code>{'{{ state }}'}</code>.
              </>
            }
            value={typeof prompt.template === 'string' ? prompt.template : undefined}
            onChange={(v) => editSection('prompt', (p) => void (p.template = v ?? ''))}
            rows={4}
            mono
            placeholder="<message>{{ data.message }}</message>"
          />
        ) : (
          <CsxEditorField
            value={promptScript}
            onChange={(next) =>
              editSection('prompt', (p) => {
                delete p.template;
                p.location = next.location;
                p.code = next.code;
                p.encoding = next.encoding === 'NAT' ? 'NAT' : 'B64';
              })
            }
            onRemove={() =>
              editSection('prompt', (p) => {
                delete p.location;
                delete p.code;
                delete p.encoding;
              })
            }
            templateType="agentPrompt"
            contextName={`${stateKey}-prompt`}
            label="IAgentPromptMapping"
            stateKey={stateKey}
            listField="agent"
            index={0}
            scriptField="prompt"
            allowRefEncoding={false}
          />
        )}

        <div className="mt-3 space-y-1.5">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wide">Seed messages</div>
          <Hint>Sent before the user prompt on every run (few-shot examples, extra instructions). Content is a template.</Hint>
          {messages.map((m, index) => (
            <div key={index} className="border-border-subtle flex items-start gap-1.5 rounded-lg border p-1.5">
              <div className="w-24 shrink-0">
                <SelectBox
                  label="Role"
                  value={typeof m.role === 'string' ? m.role : 'user'}
                  options={ROLES}
                  onChange={(v) => editSection('prompt', (p) => void ((p.messages as Json[])[index].role = v ?? 'user'))}
                />
              </div>
              <div className="flex-1">
                <TextAreaField
                  label="Content"
                  value={typeof m.content === 'string' ? m.content : undefined}
                  onChange={(v) => editSection('prompt', (p) => void ((p.messages as Json[])[index].content = v ?? ''))}
                  rows={2}
                />
              </div>
              <div className="pt-5">
                <RemoveButton
                  label={`Remove message ${index + 1}`}
                  onClick={() =>
                    editSection('prompt', (p) => {
                      (p.messages as Json[]).splice(index, 1);
                      if ((p.messages as Json[]).length === 0) delete p.messages;
                    })
                  }
                />
              </div>
            </div>
          ))}
          <AddButton
            label="Add seed message"
            onClick={() =>
              editSection('prompt', (p) => {
                const list = Array.isArray(p.messages) ? (p.messages as Json[]) : [];
                list.push({ role: 'user', content: '' });
                p.messages = list;
              })
            }
          />
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wide">Context</div>
          <Hint>
            Named values appended as <code>{'<data name="…">'}</code> blocks, so the model reads them as data, not instructions. Paths
            start with <code>data.</code>, <code>body.</code> or <code>instance.</code>.
          </Hint>
          {Object.entries(context).map(([name, path]) => (
            <ContextRow
              key={name}
              name={name}
              path={path}
              onRename={(nextName) =>
                editSection('prompt', (p) => {
                  const entries = Object.entries(isRecord(p.context) ? p.context : {});
                  p.context = Object.fromEntries(entries.map(([k, v]) => [k === name ? nextName : k, v]));
                })
              }
              onPath={(nextPath) => editSection('prompt', (p) => void ((p.context as Json)[name] = nextPath))}
              onRemove={() =>
                editSection('prompt', (p) => {
                  delete (p.context as Json)[name];
                  setOrDelete(p, 'context', p.context);
                })
              }
            />
          ))}
          <AddButton
            label="Add context value"
            onClick={() =>
              editSection('prompt', (p) => {
                const ctx = isRecord(p.context) ? p.context : {};
                let n = 1;
                while (`value${n}` in ctx) n += 1;
                ctx[`value${n}`] = 'data.';
                p.context = ctx;
              })
            }
          />
        </div>
      </Section>

      {/* Output */}
      <Section title="Output" defaultOpen>
        <TextField
          label="Output path"
          hint="JSON path in instance data the structured output (plus the $agent run summary) is merged under."
          value={isRecord(agent.output) && typeof agent.output.path === 'string' ? agent.output.path : undefined}
          onChange={(v) => editSection('output', (o) => void (o.path = v ?? ''))}
          mono
          placeholder="$.triage"
        />
      </Section>

      <AgentDecisionSection state={state} onEditDecision={(fn) => editSection('decision', fn)} />

      {/* Memory override */}
      <Section title="Memory override" defaultOpen={isRecord(agent.memory)}>
        <Hint>Overrides the agent component’s memory for this state.</Hint>
        <AgentMemoryFields
          value={agent.memory}
          overrideOfComponent
          onChange={(next) => edit((a) => setOrDelete(a, 'memory', next))}
        />
      </Section>

      {/* Tools */}
      <Section title="Tools" count={excludedTools.length} defaultOpen={excludedTools.length > 0}>
        <ChipsField
          label="Hidden tools"
          hint="Tool names the model does not see in this state (MCP tools by their prefixed name)."
          values={excludedTools}
          suggestions={toolSuggestions}
          onChange={(next) =>
            editSection('tools', (t) => {
              setOrDelete(t, 'exclude', next);
            })
          }
        />
      </Section>

      {/* Policy */}
      <Section title="Policy" defaultOpen={isRecord(agent.policy)}>
        <AgentPolicyFields value={agent.policy} narrowing onChange={(next) => edit((a) => setOrDelete(a, 'policy', next))} />
      </Section>

      <ChooseExistingVnextComponentDialog
        open={picker !== null}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        category="agents"
        onSelect={(component) => {
          handlePick(component);
          setPicker(null);
        }}
      />
      {dryRunOpen && leadKey && (
        <AgentDryRunDialog
          open={dryRunOpen}
          onOpenChange={setDryRunOpen}
          agentRef={agent.agent as Json}
          state={state}
          agentJson={selected?.json}
        />
      )}
    </div>
  );
}

function ContextRow({
  name,
  path,
  onRename,
  onPath,
  onRemove,
}: {
  name: string;
  path: string;
  onRename: (next: string) => void;
  onPath: (next: string) => void;
  onRemove: () => void;
}) {
  const [draftName, setDraftName] = useState(name);
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={draftName}
        aria-label="Context name"
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={() => {
          if (draftName && draftName !== name) onRename(draftName);
          else setDraftName(name);
        }}
        className="border-border bg-muted-surface w-28 rounded-lg border px-2 py-1 font-mono text-[11px]"
      />
      <input
        value={path}
        aria-label={`Context ${name} path`}
        onChange={(e) => onPath(e.target.value)}
        className="border-border bg-muted-surface min-w-0 flex-1 rounded-lg border px-2 py-1 font-mono text-[11px]"
      />
      <RemoveButton label={`Remove context ${name}`} onClick={onRemove} />
    </div>
  );
}
