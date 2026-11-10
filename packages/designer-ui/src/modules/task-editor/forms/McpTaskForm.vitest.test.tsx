import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { McpTaskForm } from './McpTaskForm';
import { mcpConfigIssues, setMcpOperation } from './mcpTaskConfig';

const valid = {
  transport: 'http',
  endpoint: 'https://crm-mcp.internal/mcp',
  auth: { header: 'Authorization', scheme: 'Bearer', secretRef: 'vault/workflow-secret/CRM_MCP_TOKEN' },
  headers: { 'X-Tenant': { secretRef: 'CRM_TENANT' } },
  operation: 'callTool',
  tool: 'search_customer',
  arguments: { q: 'x' },
  timeoutSeconds: 20,
};

describe('mcpConfigIssues (runtime 0.0.105 Mcp task)', () => {
  it('accepts the documented example', () => {
    expect(mcpConfigIssues(valid)).toEqual([]);
  });

  it('rejects plain-text header values and an auth block without a secretRef', () => {
    const issues = mcpConfigIssues({ ...valid, headers: { 'X-Tenant': 'acme' }, auth: { header: 'Authorization' } });
    expect(issues).toContain('Header "X-Tenant" has a plain-text value; use a secretRef.');
    expect(issues).toContain('Authentication needs a secretRef.');
  });

  it('requires the operation target and a timeout within 1..120', () => {
    expect(mcpConfigIssues({ ...valid, operation: 'readResource', timeoutSeconds: 500 })).toEqual([
      'Resource URI is required for readResource.',
      'Timeout must be 1–120 seconds.',
    ]);
  });
});

describe('setMcpOperation', () => {
  it('drops members the new operation does not use', () => {
    const draft: Record<string, unknown> = { ...valid };
    setMcpOperation(draft, 'listTools');
    expect(draft).not.toHaveProperty('tool');
    expect(draft).not.toHaveProperty('arguments');
    expect(draft).toMatchObject({ operation: 'listTools', transport: 'http', endpoint: valid.endpoint });
  });
});

describe('McpTaskForm', () => {
  it('never renders a secret value and flags a plain-text header', () => {
    const html = renderToStaticMarkup(
      createElement(McpTaskForm, { config: { ...valid, headers: { 'X-Api-Key': 'top-secret-value' } }, onChange: () => undefined }),
    );
    expect(html).not.toContain('top-secret-value');
    expect(html).toContain('Replace with a secretRef');
    expect(html).toContain('vault/workflow-secret/CRM_MCP_TOKEN');
  });
});
