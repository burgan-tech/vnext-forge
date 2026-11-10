import { useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';

import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
// Import shared fields by direct path (not './shared') — the barrel drags
// store/transport deps; component-readonly relies on this staying lean.
import { BodyJsonField } from './shared/BodyJsonField.js';
import { MCP_OPERATIONS, mcpConfigIssues, MCP_OPERATION_FIELD, setMcpOperation } from './mcpTaskConfig';

interface Props {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Mcp task (type 24, runtime 0.0.105): one operation of a remote MCP server
 * over streamable HTTP, run in-process on the orchestrator. Credentials only
 * travel as `secretRef` (a Dapr secret `store/bundle/key` or a configuration
 * key); the form never offers a plain-text header or token value.
 */
export function McpTaskForm({ config, onChange }: Props) {
  const operation = typeof config.operation === 'string' ? config.operation : 'callTool';
  const auth = isRecord(config.auth) ? config.auth : undefined;
  const headers = isRecord(config.headers) ? config.headers : {};
  const issues = mcpConfigIssues(config);
  const [newHeader, setNewHeader] = useState('');
  const opField = MCP_OPERATION_FIELD[operation];

  return (
    <div className="space-y-3">
      {issues.length > 0 && (
        <ul className="border-destructive-border bg-destructive-surface text-destructive-text space-y-0.5 rounded-lg border px-2.5 py-1.5 text-[11px]">
          {issues.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Transport" hint="Streamable HTTP only.">
          <Input type="text" value="http" readOnly size="sm" inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Endpoint" required hint="The host must be listed in the runtime's Mcp:AllowedHosts.">
          <Input
            type="text"
            value={typeof config.endpoint === 'string' ? config.endpoint : ''}
            onChange={(e) =>
              onChange((d: any) => {
                d.transport = 'http';
                d.endpoint = e.target.value;
              })
            }
            placeholder="https://crm-mcp.internal/mcp"
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Operation" required>
          <Select
            value={operation}
            onChange={(e) => onChange((d: any) => setMcpOperation(d, e.target.value))}
            className="text-xs">
            {MCP_OPERATIONS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Timeout (seconds)" hint="1–120.">
          <Input
            type="number"
            min={1}
            max={120}
            value={typeof config.timeoutSeconds === 'number' ? config.timeoutSeconds : ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => {
                d.timeoutSeconds = e.target.value !== '' && Number.isFinite(n) ? n : undefined;
              });
            }}
            placeholder="20"
            size="sm"
            inputClassName="text-xs"
          />
        </Field>
      </div>

      {opField && (
        <Field label={opField.label} required={opField.required} hint={opField.hint}>
          <Input
            type="text"
            value={typeof config[opField.key] === 'string' ? (config[opField.key] as string) : ''}
            onChange={(e) =>
              onChange((d: any) => {
                d[opField.key] = e.target.value || undefined;
              })
            }
            placeholder={opField.placeholder}
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
      )}

      {(operation === 'callTool' || operation === 'getPrompt') && (
        <BodyJsonField
          label="Arguments (JSON)"
          value={config.arguments}
          configKey="arguments"
          onChange={onChange}
        />
      )}

      {/* Authentication — secretRef only */}
      <div className="border-border space-y-2 rounded-lg border p-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={Boolean(auth)}
            onChange={(e) =>
              onChange((d: any) => {
                if (e.target.checked) d.auth = { header: 'Authorization', scheme: 'Bearer', secretRef: '' };
                else delete d.auth;
              })
            }
          />
          <KeyRound size={13} /> Authenticate with a secret
        </label>
        {auth && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Header">
              <Input
                type="text"
                value={typeof auth.header === 'string' ? auth.header : ''}
                onChange={(e) => onChange((d: any) => { d.auth.header = e.target.value || undefined; })}
                placeholder="Authorization"
                size="sm"
                inputClassName="font-mono text-xs"
              />
            </Field>
            <Field label="Scheme">
              <Input
                type="text"
                value={typeof auth.scheme === 'string' ? auth.scheme : ''}
                onChange={(e) => onChange((d: any) => { d.auth.scheme = e.target.value || undefined; })}
                placeholder="Bearer"
                size="sm"
                inputClassName="font-mono text-xs"
              />
            </Field>
            <Field label="Secret ref" required hint="store/bundle/key or a configuration key — never the token.">
              <Input
                type="text"
                value={typeof auth.secretRef === 'string' ? auth.secretRef : ''}
                onChange={(e) => onChange((d: any) => { d.auth.secretRef = e.target.value; })}
                placeholder="vault/workflow-secret/CRM_MCP_TOKEN"
                size="sm"
                inputClassName="font-mono text-xs"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Headers — values are secretRefs */}
      <Field label="Headers" hint="Every header value is a secretRef; plain-text values are rejected at publish.">
        <div className="space-y-1.5">
          {Object.entries(headers).map(([name, value]) => {
            const plain = !isRecord(value);
            return (
              <div key={name} className="flex items-center gap-1.5">
                <span className="bg-muted w-40 shrink-0 truncate rounded-md px-2 py-1 font-mono text-[11px]">{name}</span>
                {plain ? (
                  <div className="text-destructive-text flex flex-1 items-center gap-2 text-[11px]">
                    Plain-text value (not shown).
                    <button
                      type="button"
                      onClick={() => onChange((d: any) => { d.headers[name] = { secretRef: '' }; })}
                      className="border-border hover:bg-muted cursor-pointer rounded-md border px-2 py-0.5 text-foreground">
                      Replace with a secretRef
                    </button>
                  </div>
                ) : (
                  <Input
                    type="text"
                    aria-label={`${name} secretRef`}
                    value={typeof value.secretRef === 'string' ? value.secretRef : ''}
                    onChange={(e) => onChange((d: any) => { d.headers[name] = { ...d.headers[name], secretRef: e.target.value }; })}
                    placeholder="secretRef"
                    size="sm"
                    inputClassName="font-mono text-xs"
                  />
                )}
                <button
                  type="button"
                  aria-label={`Remove header ${name}`}
                  onClick={() =>
                    onChange((d: any) => {
                      delete d.headers[name];
                      if (Object.keys(d.headers).length === 0) delete d.headers;
                    })
                  }
                  className="text-muted-foreground hover:text-destructive-text cursor-pointer rounded p-1">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5">
            <Input
              type="text"
              aria-label="New header name"
              value={newHeader}
              onChange={(e) => setNewHeader(e.target.value)}
              placeholder="X-Tenant"
              size="sm"
              inputClassName="font-mono text-xs"
            />
            <button
              type="button"
              disabled={!newHeader.trim() || newHeader.trim() in headers}
              onClick={() => {
                const name = newHeader.trim();
                onChange((d: any) => {
                  d.headers = { ...(isRecord(d.headers) ? d.headers : {}), [name]: { secretRef: '' } };
                });
                setNewHeader('');
              }}
              className="border-border hover:bg-muted flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40">
              <Plus size={12} /> Add header
            </button>
          </div>
        </div>
      </Field>
    </div>
  );
}
