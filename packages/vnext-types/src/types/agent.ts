import type { MappingCode } from './mapping';
import type { ResourceReference } from './state';

/**
 * AI Agent state (`stateType: 6`), `sys-agents` component and Mcp task
 * (type 24) shapes. Runtime 0.0.105 / vnext-schema 0.0.60, experimental
 * (vnext#1105). The JSON is the source of truth; these types describe the
 * documented members only and every editor keeps unknown members intact.
 */

export const SYS_AGENTS_FLOW = 'sys-agents';

/* ────────────── Shared agent settings ────────────── */

export type AgentMemoryMode = 'none' | 'state' | 'flow' | 'key';
export type AgentMemoryStorage = 'local' | 'provider';
export type AgentMemoryCompaction = 'trim' | 'summarize';
export type AgentMemoryResetOn = 'agentVersionChange' | 'instructionsChange';

export interface AgentMemory {
  mode?: AgentMemoryMode;
  /** Key template; required with mode `key` and only used with it. */
  key?: string;
  storage?: AgentMemoryStorage;
  maxMessages?: number;
  compaction?: AgentMemoryCompaction;
  retentionDays?: number;
  resetOn?: AgentMemoryResetOn[];
}

export type AgentRetryOn = '429' | '5xx' | 'timeout';

export interface AgentPolicy {
  maxIterations?: number;
  maxToolCalls?: number;
  maxTokens?: number;
  timeoutSeconds?: number;
  toolTimeoutSeconds?: number;
  resultMaxChars?: number;
  maxEntries?: number;
  retry?: { maxAttempts?: number; backoffMs?: number; on?: AgentRetryOn[] };
  onProviderError?: 'fallback' | 'fault';
}

/* ────────────── State `agent` block ────────────── */

export type AgentStateMode = 'single' | 'sequential' | 'concurrent' | 'handoff';
export type AgentDecisionMode = 'model' | 'rules' | 'script';
export type AgentPromptRole = 'system' | 'user' | 'assistant';

export interface AgentParticipant {
  /** `^[a-zA-Z0-9_-]{1,64}$`, unique in the state. */
  name: string;
  agent: ResourceReference;
  description?: string;
}

export interface AgentPromptMessage {
  role: AgentPromptRole;
  content: string;
}

export interface AgentPrompt {
  template?: string;
  /** C# `IAgentPromptMapping` instead of a template. */
  location?: string;
  code?: string;
  encoding?: 'B64' | 'NAT';
  messages?: AgentPromptMessage[];
  /** Name → `data.…` / `body.…` / `instance.…` path. */
  context?: Record<string, string>;
}

export interface AgentDecision {
  mode?: AgentDecisionMode;
  /** Required: the automatic transition taken when the run cannot decide. */
  fallback: string;
  onApprovalRequest?: string | null;
  onExhausted?: string | null;
  exclude?: string[];
  hints?: Record<string, string>;
  hintsMapping?: MappingCode | null;
  /** Required when mode is `script` (C# `IAgentDecisionMapping`). */
  mapping?: MappingCode | null;
}

export interface AgentStateBinding {
  agent: ResourceReference;
  mode?: AgentStateMode;
  agents?: AgentParticipant[];
  prompt: AgentPrompt;
  output: { path: string };
  memory?: AgentMemory;
  tools?: { exclude?: string[] };
  decision: AgentDecision;
  /** Narrows the component's policy only. */
  policy?: AgentPolicy;
}

/* ────────────── `sys-agents` component ────────────── */

export enum AgentToolKind {
  Task = 1,
  Script = 2,
  Mcp = 3,
}

export interface AgentToolBinding {
  /** Kind 1: the sys-tasks component. Kind 3: the MCP task (type 24). */
  task?: ResourceReference;
  /** Kind 1: optional IMapping. */
  mapping?: MappingCode;
  /** Kind 2: dynamicExpresso expression (NAT) or C# IToolHandler. */
  code?: MappingCode;
  /** Kind 3: server tool names exposed to the model. */
  allow?: string[];
  /** Kind 3: prefix added to every server tool name. */
  prefix?: string;
  discoveryCacheMinutes?: number;
}

export interface AgentTool {
  kind: AgentToolKind;
  /** Kinds 1 and 2. `^[a-zA-Z0-9_-]{1,64}$`. */
  name?: string;
  description?: string;
  /** JSON schema with `type: object`. */
  parameters?: Record<string, unknown>;
  requiresApproval?: boolean;
  roles?: string[];
  timeoutSeconds?: number;
  resultMaxChars?: number;
  binding: AgentToolBinding;
}

export interface AgentInstructions {
  text?: string;
  location?: string;
  code?: string;
  encoding?: 'B64' | 'NAT';
}

export interface AgentDefinitionAttributes {
  /** Provider profile name — never an endpoint or a key. */
  provider: string;
  runtime?: 'maf';
  model?: { temperature?: number; maxOutputTokens?: number; topP?: number };
  instructions: AgentInstructions;
  tools?: AgentTool[];
  memory?: AgentMemory;
  output: { schema: Record<string, unknown> };
  policy: AgentPolicy;
  audit?: { transcript?: 'none' | 'summary' | 'full'; persistToolResults?: boolean; redact?: string[] };
}

export interface VnextAgent {
  $schema?: string;
  _comment?: string;
  key: string;
  version: string;
  domain: string;
  flow: typeof SYS_AGENTS_FLOW;
  flowVersion: string;
  tags: string[];
  attributes: AgentDefinitionAttributes;
}

/* ────────────── Mcp task (type 24) ────────────── */

export type McpOperation =
  | 'callTool'
  | 'listTools'
  | 'readResource'
  | 'listResources'
  | 'getPrompt'
  | 'listPrompts';

export interface McpSecretRef {
  secretRef: string;
}

export interface McpTaskConfig {
  transport: 'http';
  endpoint: string;
  auth?: { header?: string; scheme?: string; secretRef: string };
  /** Header values only as `{ secretRef }` — plain text is a publish error. */
  headers?: Record<string, McpSecretRef>;
  operation: McpOperation;
  tool?: string;
  uri?: string;
  prompt?: string;
  arguments?: Record<string, unknown>;
  timeoutSeconds?: number;
}
