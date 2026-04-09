import { Field } from '@modules/save-component/components/Field';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprServiceTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="App ID">
        <input type="text" value={String(config.appId || '')}
          onChange={(e) => onChange((d: any) => { d.appId = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Method Name">
        <input type="text" value={String(config.methodName || '')}
          onChange={(e) => onChange((d: any) => { d.methodName = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="HTTP Method">
        <select value={String(config.httpMethod || 'POST')}
          onChange={(e) => onChange((d: any) => { d.httpMethod = e.target.value; })}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
      </Field>
    </div>
  );
}
