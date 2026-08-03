import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { KVEditor } from '../../../ui/KeyValueEditor';
import { Select } from '../../../ui/Select';
import { TagEditor } from '../../../ui/TagEditor';
// Import shared fields by direct path (not './shared') — the barrel drags
// store/transport deps; component-readonly relies on this staying lean.
import { BodyJsonField } from './shared/BodyJsonField.js';

interface Props {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

type StateStoreCommand = 'get' | 'set' | 'delete';

/** Config keys valid for each command; the rest are pruned on command switch. */
const COMMAND_FIELDS: Record<StateStoreCommand, string[]> = {
  get: ['command', 'storeName', 'key', 'etag', 'consistency', 'metadata'],
  set: [
    'command',
    'storeName',
    'key',
    'value',
    'ttlInSeconds',
    'etag',
    'concurrency',
    'consistency',
    'metadata',
  ],
  delete: ['command', 'storeName', 'key', 'keys', 'query', 'etag', 'concurrency', 'metadata'],
};

export function StateStoreTaskForm({ config, onChange }: Props) {
  const command = (String(config.command || 'get') as StateStoreCommand);

  const metadata = config.metadata as Record<string, string> | undefined;
  const metadataPairs = metadata
    ? Object.entries(metadata).map(([key, value]) => ({ key, value: String(value) }))
    : [];

  const setCommand = (next: string) => {
    onChange((d: any) => {
      d.command = next;
      const allowed = COMMAND_FIELDS[(next as StateStoreCommand)] ?? COMMAND_FIELDS.get;
      for (const field of Object.keys(d)) {
        if (!allowed.includes(field)) delete d[field];
      }
    });
  };

  return (
    <div className="space-y-3">
      <Field label="Command" required>
        <Select
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="text-xs">
          <option value="get">Get</option>
          <option value="set">Set</option>
          <option value="delete">Delete</option>
        </Select>
      </Field>
      <Field
        label="Store Name"
        hint="Dapr state store component name. Leave empty to use the runtime's DAPR_STATE_STORE_NAME.">
        <Input
          type="text"
          value={String(config.storeName || '')}
          onChange={(e) => onChange((d: any) => { d.storeName = e.target.value || undefined; })}
          placeholder="statestore"
          size="sm"
          inputClassName="font-mono text-xs"
        />
      </Field>
      <Field label="Key" hint="Cache key targeted by get, set and single-key delete.">
        <Input
          type="text"
          value={String(config.key || '')}
          onChange={(e) => onChange((d: any) => { d.key = e.target.value || undefined; })}
          placeholder="customer-{instanceId}"
          size="sm"
          inputClassName="font-mono text-xs"
        />
      </Field>

      {command === 'set' && (
        <>
          <BodyJsonField
            label="Value (JSON)"
            value={config.value}
            configKey="value"
            onChange={onChange}
          />
          <Field label="TTL (seconds)" hint="Optional time-to-live applied on set.">
            <Input
              type="number"
              min={1}
              value={config.ttlInSeconds == null ? '' : Number(config.ttlInSeconds)}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange((d: any) => {
                  d.ttlInSeconds = e.target.value !== '' && Number.isFinite(n) && n >= 1 ? n : undefined;
                });
              }}
              placeholder="e.g. 3600"
              size="sm"
              inputClassName="text-xs"
            />
          </Field>
        </>
      )}

      {command === 'delete' && (
        <>
          <Field label="Keys (bulk delete)" hint="Optional list of keys for bulk delete.">
            <TagEditor
              tags={(config.keys as string[] | undefined) ?? []}
              onChange={(tags) => onChange((d: any) => { d.keys = tags.length > 0 ? tags : undefined; })}
              placeholder="Add key and press Enter"
            />
          </Field>
          <BodyJsonField
            label="Query (JSON)"
            value={config.query}
            configKey="query"
            onChange={onChange}
          />
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="ETag" hint="Optional optimistic concurrency tag.">
          <Input
            type="text"
            value={String(config.etag || '')}
            onChange={(e) => onChange((d: any) => { d.etag = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
        {command !== 'get' && (
          <Field label="Concurrency">
            <Select
              value={String(config.concurrency || '')}
              onChange={(e) => onChange((d: any) => { d.concurrency = e.target.value || undefined; })}
              className="text-xs">
              <option value="">Default</option>
              <option value="FirstWrite">FirstWrite</option>
              <option value="LastWrite">LastWrite</option>
            </Select>
          </Field>
        )}
        {command !== 'delete' && (
          <Field label="Consistency">
            <Select
              value={String(config.consistency || '')}
              onChange={(e) => onChange((d: any) => { d.consistency = e.target.value || undefined; })}
              className="text-xs">
              <option value="">Default</option>
              <option value="Eventual">Eventual</option>
              <option value="Strong">Strong</option>
            </Select>
          </Field>
        )}
      </div>

      <Field label="Metadata" hint="Optional metadata passed to the Dapr state store operation.">
        <KVEditor
          pairs={metadataPairs}
          onChange={(pairs) => onChange((d: any) => {
            d.metadata = pairs.length > 0
              ? Object.fromEntries(pairs.map((p) => [p.key, p.value]))
              : undefined;
          })}
        />
      </Field>
    </div>
  );
}
