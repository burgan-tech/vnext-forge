import { describe, expect, it } from 'vitest';

import { parseInjectedRuntimeUrl } from '../../app/RuntimeUrlSync';
import {
  agentRunStatusName,
  decisionSourceName,
  describeAgentCallFailure,
  describeAgentRuntimeError,
  dryRunOutcome,
  statusTone,
  toolCallStatusName,
} from './AgentRunsApi';

describe('agent-runs enum names', () => {
  it('normalizes the camelCase names the runtime sends and the numeric form', () => {
    expect(toolCallStatusName('approvalPending')).toBe('ApprovalPending');
    expect(toolCallStatusName('denied')).toBe('Denied');
    expect(toolCallStatusName(7)).toBe('Denied');
    expect(agentRunStatusName('completed')).toBe('Completed');
    expect(agentRunStatusName(3)).toBe('ApprovalRequested');
    expect(decisionSourceName('approvalRequest')).toBe('ApprovalRequest');
  });

  it('colours approval and denial distinctly', () => {
    expect(statusTone(toolCallStatusName('approvalPending'))).toContain('amber');
    expect(statusTone(toolCallStatusName('denied'))).toContain('rose');
  });
});

describe('describeAgentRuntimeError', () => {
  it('shows status, code and the runtime message with the dry-run role hint on 403', () => {
    const e = describeAgentRuntimeError(
      { httpStatus: 403, code: 'forbidden.Agent:100004', message: 'Agent dry-run is not allowed for this caller.', traceId: 't' },
      'dryRun',
    );
    expect(e.title).toBe('HTTP 403 · forbidden.Agent:100004');
    expect(e.detail).toBe('Agent dry-run is not allowed for this caller.');
    expect(e.hint).toContain('AiAgent:DryRun:Roles');
    expect(e.traceId).toBe('t');
  });

  it('points at the environment on a wrong-domain answer', () => {
    const e = describeAgentRuntimeError(
      { httpStatus: 400, code: 'failure.Instance:100001', message: 'Invalid domain: "ai-demo". Expected domain is "core".' },
      'dryRun',
      'http://localhost:4201',
    );
    expect(e.detail).toContain('Invalid domain');
    expect(e.hint).toContain('http://localhost:4201');
  });

  it('explains a 404 of agent-runs', () => {
    expect(describeAgentRuntimeError({ httpStatus: 404 }, 'agentRuns').hint).toContain('functions/agent-runs');
  });
});

describe('describeAgentCallFailure', () => {
  it('keeps the Forge code and message of a transport failure', () => {
    const e = describeAgentCallFailure({ code: 'RUNTIME_CONNECTION_FAILED', message: 'Could not connect.' });
    expect(e.title).toBe('RUNTIME_CONNECTION_FAILED');
    expect(e.detail).toBe('Could not connect.');
    expect(e.hint).toContain('reach the runtime');
  });
});

describe('parseInjectedRuntimeUrl', () => {
  it('accepts http(s) URLs and trims trailing slashes', () => {
    expect(parseInjectedRuntimeUrl('http://localhost:4211/')).toBe('http://localhost:4211');
    expect(parseInjectedRuntimeUrl('ftp://x')).toBeNull();
    expect(parseInjectedRuntimeUrl(42)).toBeNull();
  });
});

describe('dryRunOutcome', () => {
  const pending = [{ requestId: 'r1', callId: 'c1', tool: 'issue_refund', arguments: { amount: 10 }, requiresConfirmation: true }];

  it('presents ApprovalRequested as an approval, with the pending tool calls', () => {
    expect(dryRunOutcome({ status: 'ApprovalRequested', failureReason: null, pendingApprovals: pending })).toEqual({
      kind: 'approval',
      pending,
    });
    expect(dryRunOutcome({ status: 'approvalRequested', pendingApprovals: [] })).toEqual({ kind: 'approval', pending: [] });
  });

  it('never labels an older runtime’s ApprovalRequested as a failure; its message becomes a note', () => {
    expect(dryRunOutcome({ status: 'ApprovalRequested', failureReason: '1 tool call(s) wait for approval' })).toEqual({
      kind: 'approval',
      pending: null,
      note: '1 tool call(s) wait for approval',
    });
  });

  it('treats only Failed, Timeout and BudgetExceeded as failures', () => {
    expect(dryRunOutcome({ status: 'failed', failureReason: 'boom' })).toEqual({ kind: 'failure', status: 'Failed', reason: 'boom' });
    expect(dryRunOutcome({ status: 'Timeout' })).toEqual({ kind: 'failure', status: 'Timeout' });
    expect(dryRunOutcome({ status: 'budgetExceeded', failureReason: 'tokens' }).kind).toBe('failure');
    expect(dryRunOutcome({ status: 'completed', failureReason: 'ignored' })).toEqual({ kind: 'done', status: 'Completed' });
  });
});
