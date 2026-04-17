import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function GetInstancesTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="Domain">
        <Input type="text" value={String(config.domain || '')}
          onChange={(e) => onChange((d: any) => { d.domain = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Flow">
        <Input type="text" value={String(config.flow || '')}
          onChange={(e) => onChange((d: any) => { d.flow = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Page Size">
        <Input type="number" value={Number(config.pageSize || 20)}
          onChange={(e) => onChange((d: any) => { d.pageSize = Number(e.target.value); })}
          size="sm"
          inputClassName="text-xs" />
      </Field>
      <Field label="Filter">
        <Input type="text" value={String(config.filter || '')}
          onChange={(e) => onChange((d: any) => { d.filter = e.target.value; })}
          placeholder="OData filter expression"
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Sort">
        <Input type="text" value={String(config.sort || '')}
          onChange={(e) => onChange((d: any) => { d.sort = e.target.value; })}
          placeholder="Field name"
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
    </div>
  );
}

