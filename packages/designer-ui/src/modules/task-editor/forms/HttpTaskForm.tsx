import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { KVEditor } from '../../../ui/KeyValueEditor';
import { Select } from '../../../ui/Select';
import { AcceptedStatusCodesField, BodyJsonField } from './shared';

interface HttpTaskFormProps {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

export function HttpTaskForm({ config, onChange }: HttpTaskFormProps) {
  const headers = config.headers as Record<string, string> | undefined;
  const headerPairs = headers
    ? Object.entries(headers).map(([key, value]) => ({ key, value }))
    : [];

  return (
    <div className="space-y-3">
      <Field label="Method" required>
        <Select value={String(config.method || 'GET')}
          onChange={(e) => onChange((d: any) => { d.method = e.target.value; })}
          className="text-xs">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </Select>
      </Field>
      <Field label="URL" required>
        <Input type="text" value={String(config.url || '')}
          onChange={(e) => onChange((d: any) => { d.url = e.target.value; })}
          placeholder="https://..."
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <BodyJsonField value={config.body} onChange={onChange} />
      <Field label="Headers">
        <KVEditor pairs={headerPairs}
          onChange={(pairs) => onChange((d: any) => {
            d.headers = pairs.length > 0
              ? Object.fromEntries(pairs.map((p) => [p.key, p.value]))
              : undefined;
          })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timeout (seconds)">
          <Input type="number" value={Number(config.timeoutSeconds ?? 30)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.timeoutSeconds = Number.isFinite(n) ? n : undefined; });
            }}
            size="sm"
            inputClassName="text-xs" />
        </Field>
        <Field label="Validate SSL">
          <Select value={config.validateSsl === false ? 'false' : 'true'}
            onChange={(e) => onChange((d: any) => { d.validateSsl = e.target.value === 'true'; })}
            className="text-xs">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </Field>
      </div>
      <AcceptedStatusCodesField
        value={config.acceptedStatusCodes as string[] | undefined}
        onChange={onChange}
      />
    </div>
  );
}
