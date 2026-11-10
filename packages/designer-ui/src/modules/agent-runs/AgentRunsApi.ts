import type { ApiResponse } from '@vnext-forge-studio/app-contracts';
import type { AgentCandidate } from '@vnext-forge-studio/vnext-types';

import { callApi } from '../../api/client';

/**
 * AI Agent read / try surfaces of runtime 0.0.105 (vnext#1105), through the
 * `quickrun/getAgentRuns` and `quickrun/agentDryRun` methods (runtime proxy).
 * Run and tool-call rows keep the runtime's shape; enum members may arrive as
 * names or numbers, see {@link agentRunStatusName} / {@link toolCallStatusName}.
 */

export type AgentRunRow = Record<string, unknown>;
export type AgentToolCallRow = Record<string, unknown>;

export interface AgentRunsResponse {
  items?: AgentRunRow[] | null;
  detail?: { run: AgentRunRow; toolCalls: AgentToolCallRow[]; transcript?: unknown } | null;
}

export interface GetAgentRunsParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  state?: string;
  skip?: number;
  take?: number;
  runId?: string;
  includeTranscript?: boolean;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export function getAgentRuns(params: GetAgentRunsParams): Promise<ApiResponse<AgentRunsResponse>> {
  return callApi({ method: 'quickrun/getAgentRuns', params });
}

export interface AgentDryRunParams {
  domain: string;
  agentKey: string;
  version?: string;
  prompt: string;
  data?: unknown;
  candidates?: Pick<AgentCandidate, 'key' | 'when' | 'whenSource'>[];
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export interface AgentDryRunResult {
  status: string;
  output?: unknown;
  decision?: string | null;
  reason?: string | null;
  failureReason?: string | null;
  toolCalls: AgentToolCallRow[];
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
}

export function agentDryRun(params: AgentDryRunParams): Promise<ApiResponse<AgentDryRunResult>> {
  return callApi({ method: 'quickrun/agentDryRun', params });
}

const RUN_STATUS = ['', 'Running', 'Completed', 'ApprovalRequested', 'Failed', 'Timeout', 'BudgetExceeded'];
const TOOL_CALL_STATUS = ['', 'Completed', 'Failed', 'Timeout', 'Rejected', 'ApprovalPending', 'Approved', 'Denied', 'Skipped'];
const DECISION_SOURCE = ['', 'Model', 'Rules', 'Script', 'Fallback', 'Exhausted', 'ApprovalRequest'];

/**
 * Runtime enums arrive as camelCase names (`approvalPending`, `denied`) or,
 * from other serializer settings, as numbers; both become the PascalCase name.
 */
function enumName(value: unknown, names: string[]): string {
  if (typeof value === 'number') return names[value] || String(value);
  if (typeof value !== 'string' || value === '') return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const agentRunStatusName = (value: unknown) => enumName(value, RUN_STATUS);
export const toolCallStatusName = (value: unknown) => enumName(value, TOOL_CALL_STATUS);
export const decisionSourceName = (value: unknown) => enumName(value, DECISION_SOURCE);

/** Tailwind classes for a run / tool-call status chip. */
export function statusTone(status: string): string {
  switch (status) {
    case 'Completed':
    case 'Approved':
      return 'bg-emerald-500/10 text-emerald-700';
    case 'Running':
      return 'bg-sky-500/10 text-sky-700';
    case 'ApprovalRequested':
    case 'ApprovalPending':
      return 'bg-amber-500/10 text-amber-700';
    case 'Denied':
    case 'Rejected':
    case 'Failed':
    case 'Timeout':
    case 'BudgetExceeded':
      return 'bg-rose-500/10 text-rose-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
