import { Field } from '../../components/Field';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function GetInstancesTaskForm({ config, onChange }: Props) {
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
      <Field label="Page Size">
        <input type="number" value={Number(config.pageSize || 20)}
          onChange={(e) => onChange((d: any) => { d.pageSize = Number(e.target.value); })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background" />
      </Field>
      <Field label="Filter">
        <input type="text" value={String(config.filter || '')}
          onChange={(e) => onChange((d: any) => { d.filter = e.target.value; })}
          placeholder="OData filter expression"
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Sort">
        <input type="text" value={String(config.sort || '')}
          onChange={(e) => onChange((d: any) => { d.sort = e.target.value; })}
          placeholder="Field name"
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
    </div>
  );
}
