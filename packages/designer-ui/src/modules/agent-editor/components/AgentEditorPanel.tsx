import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { decodeBase64, encodeBase64 } from '@vnext-forge-studio/vnext-types';

import { useProjectStore } from '../../../store/useProjectStore';
import { AgentDryRunDialog } from '../../agent-runs/AgentDryRunDialog';
import { JsonObjectCodeField } from './JsonObjectCodeField';
import {
  attributesOf,
  isRecord,
  mutateAddAgentTool,
  mutateAgentAttribute,
  mutateAgentSection,
  mutateAgentTool,
  mutateRemoveAgentTool,
  type Json,
} from '../agentDocument';
import { AgentMetadataForm } from './AgentMetadataForm';
import { AgentMemoryFields, AgentPolicyFields } from './AgentSettingsFields';
import { AgentToolsSection } from './AgentToolsSection';
import {
  ChipsField,
  Hint,
  NumberField,
  SelectBox,
  TextAreaField,
  TextField,
  RowAligned,
  ToggleField,
} from './agentFormPrimitives';

interface AgentEditorPanelProps {
  json: Json;
  onChange: (mutator: (draft: Json) => void) => void;
}

function Panel({ title, children, defaultOpen = true, aside }: { title: string; children: ReactNode; defaultOpen?: boolean; aside?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-border bg-surface rounded-xl border">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-foreground flex flex-1 cursor-pointer items-center gap-1.5 text-left text-sm font-semibold">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {title}
        </button>
        {aside}
      </div>
      {open && <div className="border-border-subtle space-y-3 border-t px-4 py-3">{children}</div>}
    </section>
  );
}

function looksLikeEndpointOrSecret(value: string): boolean {
  return /:\/\/|^sk-|bearer\s/i.test(value);
}

/**
 * Editor for a `sys-agents` component (runtime 0.0.105): provider profile,
 * instructions, model settings, inline tools, memory (incl. compaction),
 * output schema, policy and audit. Every edit touches one member and keeps
 * the rest of the document — including members it does not model — intact.
 */
export function AgentEditorPanel({ json, onChange }: AgentEditorPanelProps) {
  const attrs = attributesOf(json);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const [dryRunOpen, setDryRunOpen] = useState(false);

  const provider = typeof attrs.provider === 'string' ? attrs.provider : '';
  const instructions = isRecord(attrs.instructions) ? attrs.instructions : {};
  const fromFile = typeof instructions.code === 'string' && instructions.code !== '';
  const fileEncoding = instructions.encoding === 'NAT' ? 'NAT' : 'B64';
  const fileText = fromFile
    ? fileEncoding === 'NAT'
      ? String(instructions.code)
      : safeDecode(String(instructions.code))
    : '';
  const model = isRecord(attrs.model) ? attrs.model : {};
  const output = isRecord(attrs.output) ? attrs.output : {};
  const audit = isRecord(attrs.audit) ? attrs.audit : {};

  const setAttr = (key: string, value: unknown) => onChange((d) => mutateAgentAttribute(d, key, value));
  const setSection = (section: string, key: string, value: unknown) => onChange((d) => mutateAgentSection(d, section, key, value));
  // `instructions` and `policy` are required: write them even when empty.
  const setInstructions = (key: string, value: string | undefined) =>
    onChange((d) => {
      const a = (isRecord(d.attributes) ? d.attributes : (d.attributes = {}));
      const current: Json = isRecord(a.instructions) ? a.instructions : {};
      if (value === undefined) delete current[key];
      else current[key] = value;
      a.instructions = current;
    });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4">
      <AgentMetadataForm json={json} onChange={onChange} />

      <Panel
        title="Agent"
        aside={
          <button
            type="button"
            onClick={() => setDryRunOpen(true)}
            disabled={typeof json.key !== 'string' || !json.key}
            title="Run the published agent once against sample data (runtime dry-run, stub tools)"
            className="border-border hover:bg-muted flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50">
            <FlaskConical size={12} /> Dry run
          </button>
        }>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Provider profile"
            hint="Name of an AiAgent:Providers entry on the orchestration host — never an endpoint, model name or key."
            value={provider || undefined}
            onChange={(v) => setAttr('provider', v ?? '')}
            error={provider && looksLikeEndpointOrSecret(provider) ? 'Use a provider profile name, not an endpoint or a key.' : undefined}
            mono
            placeholder="bank-llm"
          />
          <SelectBox
            label="Runtime"
            value={typeof attrs.runtime === 'string' ? attrs.runtime : undefined}
            onChange={(v) => setAttr('runtime', v)}
            emptyLabel="Default (maf)"
            options={[{ value: 'maf', label: 'Microsoft Agent Framework (maf)' }]}
          />
        </div>

        <div className="space-y-2">
          <SelectBox
            label="Instructions source"
            value={fromFile ? 'file' : 'text'}
            onChange={(v) =>
              onChange((d) => {
                const a = d.attributes as Json;
                const current = isRecord(a.instructions) ? a.instructions : {};
                a.instructions =
                  v === 'file'
                    ? { location: typeof current.location === 'string' ? current.location : './instructions.md', code: encodeBase64(typeof current.text === 'string' ? current.text : ''), encoding: 'B64' }
                    : { text: fileText || (typeof current.text === 'string' ? current.text : '') };
              })
            }
            options={[
              { value: 'text', label: 'Inline text' },
              { value: 'file', label: 'File (Markdown next to the agent, kept in sync by Forge)' },
            ]}
          />
          {fromFile && (
            <TextField
              label="Location"
              hint="Relative to this agent JSON. Forge writes the file on save and re-reads it on open; the runtime only reads the inlined copy."
              value={typeof instructions.location === 'string' ? instructions.location : undefined}
              onChange={(v) => setInstructions('location', v)}
              mono
            />
          )}
          <TextAreaField
            label="Instructions (system prompt)"
            hint="Never a template over instance data; pass data through the state prompt."
            value={fromFile ? fileText || undefined : typeof instructions.text === 'string' ? instructions.text : undefined}
            onChange={(v) =>
              fromFile
                ? setInstructions('code', fileEncoding === 'NAT' ? (v ?? '') : encodeBase64(v ?? ''))
                : setInstructions('text', v ?? '')
            }
            rows={6}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <NumberField
            label="Temperature"
            integer={false}
            value={typeof model.temperature === 'number' ? model.temperature : undefined}
            onChange={(v) => setSection('model', 'temperature', v)}
            min={0}
          />
          <NumberField
            label="Max output tokens"
            value={typeof model.maxOutputTokens === 'number' ? model.maxOutputTokens : undefined}
            onChange={(v) => setSection('model', 'maxOutputTokens', v)}
            min={1}
          />
          <NumberField
            label="Top P"
            integer={false}
            value={typeof model.topP === 'number' ? model.topP : undefined}
            onChange={(v) => setSection('model', 'topP', v)}
            min={0}
            max={1}
          />
        </div>
      </Panel>

      <Panel title="Tools">
        <AgentToolsSection
          json={json}
          projectDomain={projectDomain}
          onReplaceTool={(index, tool) => onChange((d) => mutateAgentTool(d, index, tool))}
          onAddTool={(tool) => onChange((d) => mutateAddAgentTool(d, tool))}
          onRemoveTool={(index) => onChange((d) => mutateRemoveAgentTool(d, index))}
        />
      </Panel>

      <Panel title="Output">
        <JsonObjectCodeField
          label="Output schema"
          hint='JSON schema of the structured output; root must be "type": "object". In model decision mode the runtime adds the decision and reason.'
          value={output.schema}
          requireObjectType
          height={260}
          onChange={(v) => setSection('output', 'schema', v ?? { type: 'object', properties: {} })}
        />
      </Panel>

      <Panel title="Memory" defaultOpen={isRecord(attrs.memory)}>
        <Hint>Default conversation memory; an AI Agent state may override it.</Hint>
        <AgentMemoryFields value={attrs.memory} onChange={(next) => setAttr('memory', next)} />
      </Panel>

      <Panel title="Policy">
        <AgentPolicyFields
          value={attrs.policy}
          onChange={(next) =>
            onChange((d) => {
              const a = (isRecord(d.attributes) ? d.attributes : (d.attributes = {}));
              a.policy = next ?? {};
            })
          }
        />
      </Panel>

      <Panel title="Audit" defaultOpen={isRecord(attrs.audit)}>
        <div className="grid grid-cols-2 gap-3">
          <SelectBox
            label="Transcript"
            value={typeof audit.transcript === 'string' ? audit.transcript : undefined}
            onChange={(v) => setSection('audit', 'transcript', v)}
            emptyLabel="Default"
            options={[
              { value: 'none', label: 'None' },
              { value: 'summary', label: 'Summary — final answer and tool calls' },
              { value: 'full', label: 'Full — every message' },
            ]}
          />
          <RowAligned>
            <ToggleField
              label="Keep tool results"
              checked={audit.persistToolResults === true}
              onChange={(on) => setSection('audit', 'persistToolResults', on ? true : audit.persistToolResults === undefined ? undefined : false)}
            />
          </RowAligned>
        </div>
        <ChipsField
          label="Redact"
          hint="JSON paths masked before anything is kept."
          values={Array.isArray(audit.redact) ? (audit.redact as string[]) : []}
          onChange={(next) => setSection('audit', 'redact', next)}
        />
      </Panel>

      {dryRunOpen && (
        <AgentDryRunDialog
          open={dryRunOpen}
          onOpenChange={setDryRunOpen}
          agentRef={{
            key: json.key,
            domain: typeof json.domain === 'string' && json.domain ? json.domain : projectDomain,
            version: json.version,
          }}
          agentJson={json}
        />
      )}
    </div>
  );
}

function safeDecode(value: string): string {
  try {
    return decodeBase64(value);
  } catch {
    return value;
  }
}
