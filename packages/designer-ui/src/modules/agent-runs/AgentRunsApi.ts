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

/** A non-2xx runtime answer, kept as data by the service (ProblemDetails fields). */
export interface AgentRuntimeError {
  httpStatus: number;
  code?: string;
  message?: string;
  traceId?: string;
}

export interface AgentRunsResponse {
  runtimeError?: AgentRuntimeError;
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
  /**
   * Tool calls the run stopped before (`ApprovalRequested`), named like
   * `$agent.pendingApprovals` in instance data. Older runtimes omit it and
   * put a message in `failureReason` instead.
   */
  pendingApprovals?: PendingApproval[] | null;
  runtimeError?: AgentRuntimeError;
}

export interface PendingApproval {
  requestId?: string;
  callId?: string;
  tool?: string;
  arguments?: unknown;
  requiresConfirmation?: boolean;
}

const DRY_RUN_FAILURE_STATUSES = new Set(['Failed', 'Timeout', 'BudgetExceeded']);

/** How a dry-run answer is presented. Only Failed / Timeout / BudgetExceeded are failures. */
export type DryRunOutcome =
  | { kind: 'approval'; pending: PendingApproval[] | null; note?: string }
  | { kind: 'failure'; status: string; reason?: string }
  | { kind: 'done'; status: string };

export function dryRunOutcome(result: Pick<AgentDryRunResult, 'status' | 'failureReason' | 'pendingApprovals'>): DryRunOutcome {
  const status = agentRunStatusName(result.status);
  const reason = typeof result.failureReason === 'string' && result.failureReason.trim() ? result.failureReason : undefined;
  if (status === 'ApprovalRequested') {
    const pending = Array.isArray(result.pendingApprovals) ? result.pendingApprovals : null;
    // Older runtimes send the approval message in `failureReason`; it is a
    // note then, never a failure.
    return { kind: 'approval', pending, ...(pending === null && reason ? { note: reason } : {}) };
  }
  if (DRY_RUN_FAILURE_STATUSES.has(status)) return { kind: 'failure', status, ...(reason ? { reason } : {}) };
  return { kind: 'done', status };
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

/** What an AI Agent call failure shows: the runtime's own words first, then a hint. */
export interface AgentCallError {
  /** `HTTP 403 · forbidden.Agent:100004`, or the Forge error code for a transport failure. */
  title: string;
  /** The runtime's message (ProblemDetails `detail`), or Forge's user message. */
  detail?: string;
  hint?: string;
  traceId?: string;
}

export type AgentCallSurface = 'dryRun' | 'agentRuns';

/** A runtime error answer of `quickrun/agentDryRun` / `quickrun/getAgentRuns`. */
export function describeAgentRuntimeError(
  error: AgentRuntimeError,
  surface: AgentCallSurface,
  runtimeUrl?: string,
): AgentCallError {
  const code = error.code ?? '';
  const title = [`HTTP ${error.httpStatus}`, code].filter(Boolean).join(' · ');
  let hint: string | undefined;
  if (code.endsWith('Agent:100004') || (surface === 'dryRun' && error.httpStatus === 403)) {
    hint =
      'The runtime allows dry runs only for the caller roles listed in AiAgent:DryRun:Roles. Add your role there and send it in the Forge-wide tool headers.';
  } else if (/^Invalid domain/i.test(error.message ?? '')) {
    hint = `The runtime${runtimeUrl ? ` at ${runtimeUrl}` : ''} serves another domain. Select the environment of this project's domain.`;
  } else if (surface === 'agentRuns' && error.httpStatus === 404) {
    hint =
      'The runtime does not offer functions/agent-runs (AI Agent support, vnext#1105) or the instance was not found.';
  } else if (error.httpStatus === 401) {
    hint = 'The runtime asks for authentication; add the credentials to the Forge-wide tool headers.';
  }
  return {
    title,
    ...(error.message ? { detail: error.message } : {}),
    ...(hint ? { hint } : {}),
    ...(error.traceId ? { traceId: error.traceId } : {}),
  };
}

/** A failed Forge call (runtime unreachable, invalid params, ...): the envelope error. */
export function describeAgentCallFailure(error: { code?: string; message?: string; traceId?: string }): AgentCallError {
  return {
    title: error.code ?? 'Request failed',
    detail: error.message?.trim() ? error.message : 'The request failed.',
    ...(error.code === 'RUNTIME_CONNECTION_FAILED' || error.code === 'RUNTIME_NOT_AVAILABLE' || error.code === 'RUNTIME_TIMEOUT'
      ? { hint: 'Forge could not reach the runtime. Check that the active environment is running.' }
      : {}),
    ...(error.traceId ? { traceId: error.traceId } : {}),
  };
}
