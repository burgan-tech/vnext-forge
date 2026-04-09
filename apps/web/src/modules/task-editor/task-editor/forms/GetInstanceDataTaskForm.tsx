import { Field } from '../../components/Field';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function GetInstanceDataTaskForm({ config, onChange }: Props) {
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
      <Field label="Instance ID">
        <input type="text" value={String(config.instanceId || '')}
          onChange={(e) => onChange((d: any) => { d.instanceId = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
    </div>
  );
}
