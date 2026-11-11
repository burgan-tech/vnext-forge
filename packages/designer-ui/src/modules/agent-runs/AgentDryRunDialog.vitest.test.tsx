import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ApprovalRequired } from './AgentDryRunDialog';

describe('ApprovalRequired', () => {
  it('shows the pending tool, the confirmation badge and the arguments, not a failure', () => {
    const html = renderToStaticMarkup(
      createElement(ApprovalRequired, {
        outcome: {
          kind: 'approval',
          pending: [{ requestId: 'r1', tool: 'issue_refund', arguments: { amount: 125 }, requiresConfirmation: true }],
        },
      }),
    );
    expect(html).toContain('Approval required');
    expect(html).toContain('issue_refund');
    expect(html).toContain('Requires confirmation');
    expect(html).toContain('&quot;amount&quot;: 125');
    expect(html).not.toContain('Failure');
  });

  it('shows an older runtime’s message as plain text when the list is missing', () => {
    const html = renderToStaticMarkup(
      createElement(ApprovalRequired, { outcome: { kind: 'approval', pending: null, note: '1 tool call(s) wait for approval' } }),
    );
    expect(html).toContain('1 tool call(s) wait for approval');
    expect(html).not.toContain('Failure');
  });
});
