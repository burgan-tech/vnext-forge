import { describe, expect, it } from 'vitest';

import { agentRunStatusName, decisionSourceName, statusTone, toolCallStatusName } from './AgentRunsApi';

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
