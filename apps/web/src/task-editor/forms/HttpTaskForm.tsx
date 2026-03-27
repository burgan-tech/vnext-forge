import { Field } from '../../components/Field';
import { KVEditor } from '../../components/KVEditor';

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
      <Field label="Method">
        <select value={String(config.method || 'GET')}
          onChange={(e) => onChange((d: any) => { d.method = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
      </Field>
      <Field label="URL">
        <input type="text" value={String(config.url || '')}
          onChange={(e) => onChange((d: any) => { d.url = e.target.value; })}
          placeholder="https://..."
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Headers">
        <KVEditor pairs={headerPairs}
          onChange={(pairs) => onChange((d: any) => {
            d.headers = Object.fromEntries(pairs.filter((p) => p.key).map((p) => [p.key, p.value]));
          })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timeout (seconds)">
          <input type="number" value={Number(config.timeoutSeconds || 30)}
            onChange={(e) => onChange((d: any) => { d.timeoutSeconds = Number(e.target.value); })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background" />
        </Field>
        <Field label="Validate SSL">
          <select value={config.validateSsl === false ? 'false' : 'true'}
            onChange={(e) => onChange((d: any) => { d.validateSsl = e.target.value === 'true'; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
