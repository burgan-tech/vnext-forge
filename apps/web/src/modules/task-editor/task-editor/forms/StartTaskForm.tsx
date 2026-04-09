import { Field } from '@modules/save-component/components/Field';
import { JsonCodeField } from '@modules/save-component/components/JsonCodeField';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function StartTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="Domain">
        <input type="text" value={String(config.domain || '')}
          onChange={(e) => onChange((d: any) => { d.domain = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Flow">
        <input type="text" value={String(config.flow || '')}
          onChange={(e) => onChange((d: any) => { d.flow = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Body (JSON)">
        <JsonCodeField
          value={typeof config.body === 'string' ? config.body : JSON.stringify(config.body || {}, null, 2)}
          onChange={(v) => onChange((d: any) => { try { d.body = JSON.parse(v); } catch { d.body = v; } })}
        />
      </Field>
    </div>
  );
}
