import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { BodyJsonField, HttpSettingsFields } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprServiceTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="App ID" required>
        <Input type="text" value={String(config.appId || '')}
          onChange={(e) => onChange((d: any) => { d.appId = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Method Name" required>
        <Input type="text" value={String(config.methodName || '')}
          onChange={(e) => onChange((d: any) => { d.methodName = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="HTTP Verb" required>
        <Select value={String(config.httpVerb || 'POST')}
          onChange={(e) => onChange((d: any) => { d.httpVerb = e.target.value; })}
          className="text-xs">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </Select>
      </Field>
      <Field label="Query String">
        <Input type="text" value={String(config.queryString || '')}
          onChange={(e) => onChange((d: any) => { d.queryString = e.target.value || undefined; })}
          placeholder="key=value&key2=value2"
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <BodyJsonField value={config.body} onChange={onChange} />
      <HttpSettingsFields config={config} onChange={onChange} showValidateSsl={false} />
    </div>
  );
}
