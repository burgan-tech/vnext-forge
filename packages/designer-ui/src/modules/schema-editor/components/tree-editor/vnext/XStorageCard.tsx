import { useId } from 'react';

import { Field } from '../../../../../ui/Field';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { fileHandleShape, storageIssues } from '../../../model/storageRules';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

/** Binding names the vnext Helm chart and local stack ship with. */
const BINDING_SUGGESTIONS = ['vnext-blob-local', 'vnext-blob-s3'] as const;

const DEFAULT_VALUE = (): Record<string, unknown> => ({ binding: 'vnext-blob-local' });

/** `x-storage.transport` (vnext-schema 0.0.58 / runtime 0.0.102); absent means `inline`. */
const TRANSPORTS = [
  { value: 'inline', label: 'inline — base64 in the request body (default)' },
  { value: 'stream', label: 'stream — upload endpoint only' },
  { value: 'any', label: 'any — either way' },
] as const;

const TRANSPORT_HINTS: Record<string, string> = {
  inline:
    'Uploads are sent as base64 in the request body (about 7.5 MiB per request). Transitions that upload need their own schema with content; this master schema describes the stored handle.',
  stream:
    'Clients upload the bytes to POST …/workflows/{flow}/files?path= (up to the runtime upload limit, 64 MiB by default) and send { "file": "<id>" } in the body. Inline content is refused (Instance:100048).',
  any: 'Clients may send base64 content inline (about 7.5 MiB per request) or upload to POST …/workflows/{flow}/files?path= and send { "file": "<id>" }.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** True when the node already has the documented handle members. */
function hasHandleShape(node: Record<string, unknown> | null | undefined): boolean {
  if (!node || node.type !== 'object' || !isRecord(node.properties)) return false;
  return ['name', 'mimeType', 'size'].every((key) => (node.properties as Record<string, unknown>)[key] !== undefined);
}

/**
 * `x-storage` (vnext-schema 0.0.56 / runtime 0.0.100) turns a master-schema
 * field into a file field: the client sends `{ name, mimeType, size, content }`
 * (base64) in the start / transition body, the runtime writes the bytes to the
 * named blob binding and stores a handle in their place. The file is read back
 * through the built-in `file` function.
 */
export function XStorageCard({ pointer }: { pointer: JsonPointer }) {
  const readOnly = useFormReadOnly();
  const listId = useId();
  const { node } = useSchemaNode(pointer);
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-storage', DEFAULT_VALUE);

  const storage = isRecord(node?.['x-storage']) ? (node['x-storage'] as Record<string, unknown>) : {};
  const binding = typeof storage.binding === 'string' ? storage.binding : '';
  const transport = typeof storage.transport === 'string' ? storage.transport : '';
  const knownTransport = TRANSPORTS.some((option) => option.value === transport);

  /** Merge-patch so editing one member never drops the others; `undefined` removes a member. */
  function write(patch: Record<string, unknown>): void {
    const next: Record<string, unknown> = { ...storage, ...patch };
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
    updateComponent(setKeyword(pointer, 'x-storage', next));
  }
  const issues = enabled ? storageIssues(componentJson, pointer) : [];

  function applyHandleShape(): void {
    const shape = fileHandleShape();
    const existing = isRecord(node?.properties) ? (node.properties as Record<string, unknown>) : {};
    updateComponent((draft) => {
      setKeyword(pointer, 'type', 'object')(draft);
      setKeyword(pointer, 'properties', { ...(shape.properties as Record<string, unknown>), ...existing })(draft);
    });
  }

  return (
    <VNextCardShell
      xKey="x-storage"
      title="File storage"
      purpose="Store the bytes sent for this field in a blob store and keep only a file handle in the instance data. Master schemas only."
      enabled={enabled}
      onToggle={toggle}
      error={
        issues.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : undefined
      }>
      <Field label="Binding" required hint="Dapr output binding component on the orchestration sidecar.">
        <Input
          type="text"
          list={listId}
          value={binding}
          onChange={(event) => write({ binding: event.target.value })}
          placeholder="vnext-blob-local"
          inputClassName="font-mono text-xs"
        />
        <datalist id={listId}>
          {BINDING_SUGGESTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </Field>
      <Field label="Transport" hint="How a client may send the bytes (runtime 0.0.102).">
        <Select
          className="h-8 text-xs"
          value={transport || 'inline'}
          onChange={(event) => write({ transport: event.target.value === 'inline' ? undefined : event.target.value })}>
          {transport && !knownTransport ? <option value={transport}>{`${transport} (invalid)`}</option> : null}
          {TRANSPORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      {!hasHandleShape(node) && !readOnly ? (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-primary-text/70">
          <span>
            Describe the stored handle (<code>name</code>, <code>mimeType</code>, <code>size</code>) so forms and
            QuickRun can show it.
          </span>
          <button type="button" onClick={applyHandleShape} className="cursor-pointer font-semibold underline">
            Use file handle shape
          </button>
        </div>
      ) : null}
      <p className="text-[10px] text-primary-text/65">{TRANSPORT_HINTS[knownTransport ? transport : 'inline']}</p>
    </VNextCardShell>
  );
}
