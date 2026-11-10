import { produce } from 'immer';
import { AgentToolKind, SYS_AGENTS_FLOW } from '@vnext-forge-studio/vnext-types';

/**
 * Pure helpers over a raw `sys-agents` component JSON (runtime 0.0.105).
 * Every helper edits one member and leaves everything else — including
 * members Forge does not model — exactly as it was, so a document opens and
 * saves back unchanged.
 */

export type Json = Record<string, unknown>;

export function isRecord(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function attributesOf(json: Json): Json {
  return isRecord(json.attributes) ? json.attributes : {};
}

/** True for an empty value that should leave the JSON instead of being written. */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
}

/** Sets `target[key]`, or deletes it when the value is blank. */
export function setOrDelete(target: Json, key: string, value: unknown): void {
  if (isBlank(value)) delete target[key];
  else target[key] = value;
}

function ensureAttributes(draft: Json): Json {
  if (!isRecord(draft.attributes)) draft.attributes = {};
  return draft.attributes as Json;
}

/** Draft mutator: one `attributes` member (blank → removed). */
export function mutateAgentAttribute(draft: Json, key: string, value: unknown): void {
  setOrDelete(ensureAttributes(draft), key, value);
}

/** Draft mutator: one member of an `attributes` object such as `model`, `memory`, `policy`, `audit`. */
export function mutateAgentSection(draft: Json, section: string, key: string, value: unknown): void {
  const attrs = ensureAttributes(draft);
  const current = isRecord(attrs[section]) ? (attrs[section] as Json) : {};
  setOrDelete(current, key, value);
  setOrDelete(attrs, section, current);
}

export function toolsOf(json: Json): Json[] {
  const tools = attributesOf(json).tools;
  return Array.isArray(tools) ? (tools.filter(isRecord) as Json[]) : [];
}

export function mutateAgentTool(draft: Json, index: number, tool: Json): void {
  const attrs = ensureAttributes(draft);
  const tools = Array.isArray(attrs.tools) ? (attrs.tools as unknown[]) : [];
  tools[index] = tool;
  attrs.tools = tools;
}

export function mutateAddAgentTool(draft: Json, tool: Json): void {
  const attrs = ensureAttributes(draft);
  const tools = Array.isArray(attrs.tools) ? (attrs.tools as unknown[]) : [];
  tools.push(tool);
  attrs.tools = tools;
}

export function mutateRemoveAgentTool(draft: Json, index: number): void {
  const attrs = ensureAttributes(draft);
  if (!Array.isArray(attrs.tools)) return;
  attrs.tools.splice(index, 1);
  if (attrs.tools.length === 0) delete attrs.tools;
}

/* Immutable wrappers (tests, non-store callers). */

export function setAgentAttribute(json: Json, key: string, value: unknown): Json {
  return produce(json, (draft) => mutateAgentAttribute(draft, key, value));
}

export function setAgentTool(json: Json, index: number, tool: Json): Json {
  return produce(json, (draft) => mutateAgentTool(draft, index, tool));
}

export function toolKindOf(tool: unknown): AgentToolKind | undefined {
  const kind = isRecord(tool) ? tool.kind : undefined;
  return kind === 1 || kind === 2 || kind === 3 ? (kind as AgentToolKind) : undefined;
}

export const TOOL_KIND_LABEL: Record<AgentToolKind, string> = {
  [AgentToolKind.Task]: 'Task',
  [AgentToolKind.Script]: 'Script',
  [AgentToolKind.Mcp]: 'MCP',
};

export const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/** A new tool of the given kind with the binding member its kind requires. */
export function emptyAgentTool(kind: AgentToolKind): Json {
  const parameters = { type: 'object', properties: {} };
  switch (kind) {
    case AgentToolKind.Task:
      return {
        kind,
        name: '',
        description: '',
        parameters,
        binding: { task: { key: '', domain: '', flow: 'sys-tasks', version: '1.0.0' } },
      };
    case AgentToolKind.Script:
      return {
        kind,
        name: '',
        description: '',
        parameters,
        binding: { code: { location: 'dynamicExpresso', encoding: 'NAT', code: '' } },
      };
    case AgentToolKind.Mcp:
      return {
        kind,
        binding: { task: { key: '', domain: '', flow: 'sys-tasks', version: '1.0.0' }, allow: [] },
      };
  }
}

/** A tool's display name: its `name`, or `prefix*` for an MCP tool. */
export function toolDisplayName(tool: Json): string {
  if (typeof tool.name === 'string' && tool.name) return tool.name;
  const binding = isRecord(tool.binding) ? tool.binding : {};
  if (tool.kind === AgentToolKind.Mcp) {
    const task = isRecord(binding.task) && typeof binding.task.key === 'string' ? binding.task.key : 'mcp';
    return `${typeof binding.prefix === 'string' ? binding.prefix : ''}* (${task})`;
  }
  return '(unnamed)';
}

/**
 * Tool names the model sees: kind 1/2 `name`, kind 3 `prefix + allow[i]`.
 * Used by the state editor's `tools.exclude` picker.
 */
export function exposedToolNames(json: Json): string[] {
  const names: string[] = [];
  for (const tool of toolsOf(json)) {
    if (tool.kind === AgentToolKind.Mcp) {
      const binding = isRecord(tool.binding) ? tool.binding : {};
      const prefix = typeof binding.prefix === 'string' ? binding.prefix : '';
      for (const name of Array.isArray(binding.allow) ? binding.allow : []) {
        if (typeof name === 'string' && name) names.push(`${prefix}${name}`);
      }
    } else if (typeof tool.name === 'string' && tool.name) {
      names.push(tool.name);
    }
  }
  return names;
}

export interface AgentToolIssue {
  index: number;
  message: string;
}

/**
 * Design-time mirror of the runtime's `AgentComponentValidator` tool checks
 * (names, uniqueness after the MCP prefix, binding per kind, object schemas).
 */
export function agentToolIssues(json: Json): AgentToolIssue[] {
  const issues: AgentToolIssue[] = [];
  const seen = new Map<string, number>();
  toolsOf(json).forEach((tool, index) => {
    const kind = toolKindOf(tool);
    const binding = isRecord(tool.binding) ? tool.binding : {};
    if (!kind) {
      issues.push({ index, message: 'Tool kind must be 1 (task), 2 (script) or 3 (MCP).' });
      return;
    }
    const names: string[] = [];
    if (kind === AgentToolKind.Mcp) {
      if (!isRecord(binding.task) || !binding.task.key) issues.push({ index, message: 'MCP tool needs an MCP task (type 24).' });
      const allow = Array.isArray(binding.allow) ? binding.allow : [];
      if (allow.length === 0) issues.push({ index, message: 'MCP tool needs at least one allowed server tool.' });
      const prefix = typeof binding.prefix === 'string' ? binding.prefix : '';
      for (const name of allow) {
        const full = `${prefix}${String(name)}`;
        if (!TOOL_NAME_PATTERN.test(full)) issues.push({ index, message: `"${full}" must match ^[a-zA-Z0-9_-]{1,64}$.` });
        names.push(full);
      }
    } else {
      const name = typeof tool.name === 'string' ? tool.name : '';
      if (!TOOL_NAME_PATTERN.test(name)) issues.push({ index, message: 'Tool name must match ^[a-zA-Z0-9_-]{1,64}$.' });
      else names.push(name);
      if (typeof tool.description !== 'string' || !tool.description.trim()) {
        issues.push({ index, message: 'Tool description is required; the model chooses tools by it.' });
      }
      const parameters = tool.parameters;
      if (!isRecord(parameters) || parameters.type !== 'object') {
        issues.push({ index, message: 'Tool parameters must be a JSON schema with "type": "object".' });
      }
      if (kind === AgentToolKind.Task && (!isRecord(binding.task) || !binding.task.key)) {
        issues.push({ index, message: 'Task tool needs a sys-tasks reference.' });
      }
      if (kind === AgentToolKind.Script && (!isRecord(binding.code) || !binding.code.code)) {
        issues.push({ index, message: 'Script tool needs an expression or a C# handler.' });
      }
    }
    for (const name of names) {
      const first = seen.get(name);
      if (first !== undefined) issues.push({ index, message: `Tool name "${name}" is already used by tool ${first + 1}.` });
      else seen.set(name, index);
    }
  });
  return issues;
}

/** A new `sys-agents` component body (the template the "New agent" commands write). */
export function newAgentComponent(key: string, domain: string): Json {
  return {
    key,
    flow: SYS_AGENTS_FLOW,
    flowVersion: '1.0.0',
    domain,
    version: '1.0.0',
    tags: ['agent'],
    attributes: {
      provider: '',
      instructions: { text: '' },
      output: { schema: { type: 'object', properties: {} } },
      policy: { maxIterations: 4, maxToolCalls: 4, timeoutSeconds: 30 },
    },
  };
}
