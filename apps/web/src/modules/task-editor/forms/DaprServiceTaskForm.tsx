import { Field } from '@shared/ui/Field';
import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprServiceTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="App ID">
        <Input type="text" value={String(config.appId || '')}
          onChange={(e) => onChange((d: any) => { d.appId = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Method Name">
        <Input type="text" value={String(config.methodName || '')}
          onChange={(e) => onChange((d: any) => { d.methodName = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="HTTP Method">
        <Select value={String(config.httpMethod || 'POST')}
          onChange={(e) => onChange((d: any) => { d.httpMethod = e.target.value; })}
          className="text-xs">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </Select>
      </Field>
    </div>
  );
}

