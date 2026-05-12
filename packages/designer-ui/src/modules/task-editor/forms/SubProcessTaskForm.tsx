import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { TagEditor } from '../../../ui/TagEditor';
import { BodyJsonField, HttpSettingsFields, WorkflowRefFields } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function SubProcessTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <WorkflowRefFields config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key">
          <Input type="text" value={String(config.key || '')}
            onChange={(e) => onChange((d: any) => { d.key = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Version">
          <Input type="text" value={String(config.version || '')}
            onChange={(e) => onChange((d: any) => { d.version = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
      </div>
      <Field label="Sync">
        <Select value={config.sync === true ? 'true' : 'false'}
          onChange={(e) => onChange((d: any) => { d.sync = e.target.value === 'true'; })}
          className="text-xs">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </Select>
      </Field>
      <Field label="Tags">
        <TagEditor
          tags={(config.tags as string[]) || []}
          onChange={(tags) => onChange((d: any) => { d.tags = tags.length > 0 ? tags : undefined; })}
          placeholder="Add tag"
        />
      </Field>
      <BodyJsonField value={config.body} onChange={onChange} />
      <HttpSettingsFields config={config} onChange={onChange} />
    </div>
  );
}
