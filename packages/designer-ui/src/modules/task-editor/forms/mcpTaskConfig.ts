/**
 * Mcp task (type 24, runtime 0.0.105) config rules shared by the form and
 * its tests. Mirrors the runtime's publish checks that Forge can see: http
 * transport, an endpoint, the operation's target member, credentials only as
 * `secretRef`, timeout 1..120.
 */

export const MCP_OPERATIONS = [
  { value: 'callTool', label: 'Call tool' },
  { value: 'listTools', label: 'List tools' },
  { value: 'readResource', label: 'Read resource' },
  { value: 'listResources', label: 'List resources' },
  { value: 'getPrompt', label: 'Get prompt' },
  { value: 'listPrompts', label: 'List prompts' },
] as const;

/** The member each operation addresses (`tool`, `uri`, `prompt`); list operations have none. */
export const MCP_OPERATION_FIELD: Record<
  string,
  { key: 'tool' | 'uri' | 'prompt'; label: string; required: boolean; hint: string; placeholder: string } | undefined
> = {
  callTool: { key: 'tool', label: 'Tool', required: true, hint: 'Server tool name to call.', placeholder: 'search_customer' },
  readResource: { key: 'uri', label: 'Resource URI', required: true, hint: 'Required by readResource.', placeholder: 'crm://customers/42' },
  getPrompt: { key: 'prompt', label: 'Prompt', required: true, hint: 'Required by getPrompt.', placeholder: 'summarize' },
};

const OPERATION_MEMBERS = ['tool', 'uri', 'prompt', 'arguments'] as const;

/** Sets the operation and drops members the new operation does not use. */
export function setMcpOperation(draft: Record<string, unknown>, operation: string): void {
  draft.transport = 'http';
  draft.operation = operation;
  const keep = new Set<string>();
  const field = MCP_OPERATION_FIELD[operation];
  if (field) keep.add(field.key);
  if (operation === 'callTool' || operation === 'getPrompt') keep.add('arguments');
  for (const member of OPERATION_MEMBERS) {
    if (!keep.has(member)) delete draft[member];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function blank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

export function mcpConfigIssues(config: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (config.transport !== undefined && config.transport !== 'http') issues.push('Transport must be "http".');
  if (blank(config.endpoint)) issues.push('Endpoint is required.');
  const operation = typeof config.operation === 'string' ? config.operation : '';
  if (!MCP_OPERATIONS.some((op) => op.value === operation)) issues.push('Choose an operation.');
  const field = MCP_OPERATION_FIELD[operation];
  if (field?.required && blank(config[field.key])) issues.push(`${field.label} is required for ${operation}.`);
  if (config.auth !== undefined) {
    if (!isRecord(config.auth) || blank(config.auth.secretRef)) issues.push('Authentication needs a secretRef.');
  }
  if (isRecord(config.headers)) {
    for (const [name, value] of Object.entries(config.headers)) {
      if (!isRecord(value)) issues.push(`Header "${name}" has a plain-text value; use a secretRef.`);
      else if (blank(value.secretRef)) issues.push(`Header "${name}" needs a secretRef.`);
    }
  }
  if (config.timeoutSeconds !== undefined) {
    const t = config.timeoutSeconds;
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 1 || t > 120) issues.push('Timeout must be 1–120 seconds.');
  }
  return issues;
}
