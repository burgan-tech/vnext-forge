import { Field } from '@shared/ui/Field';
import { JsonCodeField } from '@shared/ui/JsonCodeField';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprBindingTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="Binding Name">
        <input type="text" value={String(config.bindingName || '')}
          onChange={(e) => onChange((d: any) => { d.bindingName = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Operation">
        <input type="text" value={String(config.operation || '')}
          onChange={(e) => onChange((d: any) => { d.operation = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Data (JSON)">
        <JsonCodeField
          value={typeof config.data === 'string' ? config.data : JSON.stringify(config.data || {}, null, 2)}
          onChange={(v) => onChange((d: any) => { try { d.data = JSON.parse(v); } catch { d.data = v; } })}
        />
      </Field>
    </div>
  );
}

