import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { AgentToolKind } from '@vnext-forge-studio/vnext-types';

import { CsxEditorField, type ScriptCode } from '../../save-component/components/CsxEditorField';
import { ChooseExistingVnextComponentDialog } from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import {
  agentToolIssues,
  emptyAgentTool,
  isRecord,
  toolDisplayName,
  toolKindOf,
  toolsOf,
  TOOL_KIND_LABEL,
  TOOL_NAME_PATTERN,
  type Json,
} from '../agentDocument';
import {
  ChipsField,
  Hint,
  IssueList,
  JsonObjectField,
  NumberField,
  RemoveButton,
  SelectBox,
  TextAreaField,
  TextField,
  ToggleField,
} from './agentFormPrimitives';

interface AgentToolsSectionProps {
  json: Json;
  projectDomain: string;
  onReplaceTool: (index: number, tool: Json) => void;
  onAddTool: (tool: Json) => void;
  onRemoveTool: (index: number) => void;
}

function refText(ref: unknown): string {
  if (!isRecord(ref) || typeof ref.key !== 'string' || !ref.key) return 'No task selected';
  return `${ref.key}${typeof ref.version === 'string' ? `@${ref.version}` : ''}`;
}

function scriptOf(value: unknown): ScriptCode | null {
  if (!isRecord(value) || typeof value.code !== 'string' || value.location === 'dynamicExpresso') return null;
  return {
    location: typeof value.location === 'string' ? value.location : '',
    code: value.code,
    encoding: value.encoding === 'NAT' ? 'NAT' : 'B64',
  };
}

/** Sets or drops one member of a copied tool. */
function withMember(tool: Json, key: string, value: unknown): Json {
  const next: Json = { ...tool };
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[key];
  else next[key] = value;
  return next;
}

function withBinding(tool: Json, key: string, value: unknown): Json {
  const binding: Json = { ...(isRecord(tool.binding) ? tool.binding : {}) };
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0 && key !== 'allow')) delete binding[key];
  else binding[key] = value;
  return { ...tool, binding };
}

/**
 * Inline tools of a `sys-agents` component (runtime 0.0.105): one form per
 * kind — 1 task (sys-tasks reference + optional IMapping), 2 script
 * (dynamicExpresso expression or C# IToolHandler), 3 MCP (an Mcp task +
 * allow list + prefix) — plus the `requiresApproval` toggle.
 */
export function AgentToolsSection({ json, projectDomain, onReplaceTool, onAddTool, onRemoveTool }: AgentToolsSectionProps) {
  const tools = toolsOf(json);
  const issues = useMemo(() => agentToolIssues(json), [json]);
  const [openIndex, setOpenIndex] = useState<number | null>(tools.length === 1 ? 0 : null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [newKind, setNewKind] = useState<string>(String(AgentToolKind.Script));

  const handlePick = (component: DiscoveredVnextComponent) => {
    if (pickerFor === null) return;
    const tool = tools[pickerFor];
    if (!tool) return;
    onReplaceTool(
      pickerFor,
      withBinding(tool, 'task', {
        key: component.key,
        domain: component.domain ?? projectDomain,
        flow: 'sys-tasks',
        version: component.version ?? '1.0.0',
      }),
    );
  };

  return (
    <div className="space-y-2">
      <Hint>
        Tools the model may call. A tool never writes instance data; tool calls are journaled per run. Kind 3 exposes the
        allowed tools of an MCP server through an Mcp task (type 24).
      </Hint>
      {tools.map((tool, index) => {
        const kind = toolKindOf(tool);
        const open = openIndex === index;
        const binding = isRecord(tool.binding) ? tool.binding : {};
        const toolIssues = issues.filter((i) => i.index === index).map((i) => i.message);
        return (
          <div key={index} className="border-border rounded-lg border">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-xs">
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="bg-muted text-muted-foreground rounded px-1 text-[9px] font-semibold uppercase">
                  {kind ? TOOL_KIND_LABEL[kind] : `kind ${String(tool.kind)}`}
                </span>
                <span className="truncate font-mono">{toolDisplayName(tool)}</span>
                {tool.requiresApproval === true && (
                  <span title="Requires approval" className="text-amber-600">
                    <ShieldCheck size={12} />
                  </span>
                )}
                {toolIssues.length > 0 && <span className="text-destructive-text text-[10px]">{toolIssues.length} issue(s)</span>}
              </button>
              <RemoveButton label={`Remove tool ${index + 1}`} onClick={() => onRemoveTool(index)} />
            </div>
            {open && (
              <div className="border-border-subtle space-y-2 border-t p-2">
                <IssueList issues={toolIssues} />
                {kind !== AgentToolKind.Mcp && (
                  <>
                    <TextField
                      label="Name"
                      hint="Name the model sees: letters, digits, _ and -, at most 64."
                      value={typeof tool.name === 'string' ? tool.name : undefined}
                      onChange={(v) => onReplaceTool(index, { ...tool, name: v ?? '' })}
                      error={typeof tool.name === 'string' && tool.name && !TOOL_NAME_PATTERN.test(tool.name) ? 'Invalid name.' : undefined}
                      mono
                    />
                    <TextAreaField
                      label="Description"
                      hint="The model chooses tools by it."
                      value={typeof tool.description === 'string' ? tool.description : undefined}
                      onChange={(v) => onReplaceTool(index, { ...tool, description: v ?? '' })}
                      rows={2}
                    />
                    <JsonObjectField
                      label="Parameters (JSON schema)"
                      hint='Root must be "type": "object".'
                      value={tool.parameters}
                      requireObjectType
                      onChange={(v) => onReplaceTool(index, { ...tool, parameters: v ?? { type: 'object', properties: {} } })}
                    />
                  </>
                )}

                {kind === AgentToolKind.Task && (
                  <>
                    <TaskRefRow label="Task" value={binding.task} onChoose={() => setPickerFor(index)} />
                    <CsxEditorField
                      value={scriptOf(binding.mapping)}
                      onChange={(next) => onReplaceTool(index, withBinding(tool, 'mapping', next))}
                      onRemove={() => onReplaceTool(index, withBinding(tool, 'mapping', undefined))}
                      templateType="mapping"
                      contextName={`${typeof tool.name === 'string' ? tool.name : 'tool'}-tool`}
                      label="IMapping (optional — without it the arguments become the body)"
                      stateKey="__agent__"
                      listField="tools"
                      index={index}
                      scriptField="binding.mapping"
                      allowRefEncoding={false}
                    />
                  </>
                )}

                {kind === AgentToolKind.Script && <ScriptToolBinding tool={tool} index={index} onChange={(t) => onReplaceTool(index, t)} />}

                {kind === AgentToolKind.Mcp && (
                  <>
                    <TaskRefRow
                      label="Mcp task (type 24)"
                      value={binding.task}
                      onChoose={() => setPickerFor(index)}
                    />
                    <ChipsField
                      label="Allowed server tools"
                      hint="Only these server tool names are exposed to the model."
                      values={Array.isArray(binding.allow) ? (binding.allow as string[]) : []}
                      pattern={TOOL_NAME_PATTERN}
                      onChange={(next) => onReplaceTool(index, withBinding(tool, 'allow', next))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        label="Prefix"
                        hint="Added to every server tool name, e.g. crm_."
                        value={typeof binding.prefix === 'string' ? binding.prefix : undefined}
                        onChange={(v) => onReplaceTool(index, withBinding(tool, 'prefix', v))}
                        mono
                      />
                      <NumberField
                        label="Discovery cache (min)"
                        hint="Default 10."
                        value={typeof binding.discoveryCacheMinutes === 'number' ? binding.discoveryCacheMinutes : undefined}
                        onChange={(v) => onReplaceTool(index, withBinding(tool, 'discoveryCacheMinutes', v))}
                        min={0}
                      />
                    </div>
                  </>
                )}

                <ToggleField
                  label="Requires approval"
                  hint="The run stops before the call and the state leaves through decision.onApprovalRequest (or its fallback)."
                  checked={tool.requiresApproval === true}
                  onChange={(on) => onReplaceTool(index, withMember(tool, 'requiresApproval', on ? true : undefined))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Timeout (s)"
                    value={typeof tool.timeoutSeconds === 'number' ? tool.timeoutSeconds : undefined}
                    onChange={(v) => onReplaceTool(index, withMember(tool, 'timeoutSeconds', v))}
                    min={1}
                  />
                  <NumberField
                    label="Result max chars"
                    value={typeof tool.resultMaxChars === 'number' ? tool.resultMaxChars : undefined}
                    onChange={(v) => onReplaceTool(index, withMember(tool, 'resultMaxChars', v))}
                    min={1}
                  />
                </div>
                <ChipsField
                  label="Roles"
                  hint="Caller roles that may see this tool; empty means every caller."
                  values={Array.isArray(tool.roles) ? (tool.roles as string[]) : []}
                  onChange={(next) => onReplaceTool(index, withMember(tool, 'roles', next))}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-end gap-2">
        <div className="w-40">
          <SelectBox
            label="New tool kind"
            value={newKind}
            onChange={(v) => setNewKind(v ?? String(AgentToolKind.Script))}
            options={[
              { value: String(AgentToolKind.Task), label: '1 · Task' },
              { value: String(AgentToolKind.Script), label: '2 · Script' },
              { value: String(AgentToolKind.Mcp), label: '3 · MCP' },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            onAddTool(emptyAgentTool(Number(newKind) as AgentToolKind));
            setOpenIndex(tools.length);
          }}
          className="border-border hover:bg-muted cursor-pointer rounded-lg border px-3 py-1.5 text-[11px] font-medium">
          Add tool
        </button>
      </div>

      <ChooseExistingVnextComponentDialog
        open={pickerFor !== null}
        onOpenChange={(open) => {
          if (!open) setPickerFor(null);
        }}
        category="tasks"
        title={
          pickerFor !== null && toolKindOf(tools[pickerFor]) === AgentToolKind.Mcp ? 'Choose an Mcp task (type 24)' : 'Choose a task'
        }
        onSelect={(component) => {
          handlePick(component);
          setPickerFor(null);
        }}
      />
    </div>
  );
}

function TaskRefRow({ label, value, onChoose }: { label: string; value: unknown; onChoose: () => void }) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide">{label}</div>
      <div className="flex items-center gap-2">
        <div className="border-border bg-muted-surface min-w-0 flex-1 truncate rounded-lg border px-2.5 py-1.5 font-mono text-xs">
          {refText(value)}
        </div>
        <button
          type="button"
          onClick={onChoose}
          className="border-border hover:bg-muted cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] font-medium">
          Choose…
        </button>
      </div>
    </div>
  );
}

function ScriptToolBinding({ tool, index, onChange }: { tool: Json; index: number; onChange: (tool: Json) => void }) {
  const binding = isRecord(tool.binding) ? tool.binding : {};
  const code = isRecord(binding.code) ? binding.code : undefined;
  const isExpression = !code || code.location === 'dynamicExpresso';
  return (
    <div className="space-y-2">
      <SelectBox
        label="Implementation"
        value={isExpression ? 'expression' : 'handler'}
        onChange={(v) =>
          onChange(
            withBinding(
              tool,
              'code',
              v === 'handler' ? { location: '', code: '', encoding: 'B64' } : { location: 'dynamicExpresso', encoding: 'NAT', code: '' },
            ),
          )
        }
        options={[
          { value: 'expression', label: 'Dynamic Expresso expression' },
          { value: 'handler', label: 'C# IToolHandler' },
        ]}
      />
      {isExpression ? (
        <TextAreaField
          label="Expression"
          hint={
            <>
              Reads <code>args</code>, <code>data</code> (latest instance data, read-only) and <code>now</code>; the value is
              serialized for the model.
            </>
          }
          value={code && typeof code.code === 'string' ? code.code : undefined}
          onChange={(v) => onChange(withBinding(tool, 'code', { location: 'dynamicExpresso', encoding: 'NAT', code: v ?? '' }))}
          rows={2}
          mono
          placeholder="args.count + 1"
        />
      ) : (
        <CsxEditorField
          value={scriptOf(code)}
          onChange={(next) => onChange(withBinding(tool, 'code', next))}
          onRemove={() => onChange(withBinding(tool, 'code', { location: 'dynamicExpresso', encoding: 'NAT', code: '' }))}
          templateType="toolHandler"
          contextName={`${typeof tool.name === 'string' && tool.name ? tool.name : 'tool'}`}
          label="IToolHandler"
          stateKey="__agent__"
          listField="tools"
          index={index}
          scriptField="binding.code"
          allowRefEncoding={false}
        />
      )}
    </div>
  );
}
