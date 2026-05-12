import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { TagEditor } from '../../../ui/TagEditor';
import { DaprToggleField, HttpSettingsFields, WorkflowRefFields } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function GetInstancesTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <WorkflowRefFields config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Page">
          <Input type="number" min={1} value={Number(config.page ?? 1)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.page = Number.isFinite(n) && n >= 1 ? n : undefined; });
            }}
            size="sm"
            inputClassName="text-xs" />
        </Field>
        <Field label="Page Size">
          <Input type="number" min={1} value={Number(config.pageSize ?? 10)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.pageSize = Number.isFinite(n) && n >= 1 ? n : undefined; });
            }}
            size="sm"
            inputClassName="text-xs" />
        </Field>
      </div>
      <Field label="Sort">
        <Input type="text" value={String(config.sort || '')}
          onChange={(e) => onChange((d: any) => { d.sort = e.target.value || undefined; })}
          placeholder="-CreatedAt"
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Filter">
        <TagEditor
          tags={(config.filter as string[]) || []}
          onChange={(tags) => onChange((d: any) => { d.filter = tags.length > 0 ? tags : undefined; })}
          placeholder="Add filter expression"
        />
      </Field>
      <DaprToggleField value={config.useDapr as boolean | undefined} onChange={onChange} />
      <HttpSettingsFields config={config} onChange={onChange} />
    </div>
  );
}
