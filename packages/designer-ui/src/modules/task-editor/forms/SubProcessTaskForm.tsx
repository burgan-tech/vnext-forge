import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { TagEditor } from '../../../ui/TagEditor';
import { BodyJsonField, DaprToggleField, HttpSettingsFields, WorkflowRefFields } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function SubProcessTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <WorkflowRefFields config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key">
          <Input type="text" value={String(config.triggerKey || '')}
            onChange={(e) => onChange((d: any) => { d.triggerKey = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Version">
          <Input type="text" value={String(config.triggerVersion || '')}
            onChange={(e) => onChange((d: any) => { d.triggerVersion = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
      </div>
      <Field label="Sync">
        <Select value={config.triggerSync === true ? 'true' : 'false'}
          onChange={(e) => onChange((d: any) => { d.triggerSync = e.target.value === 'true'; })}
          className="text-xs">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </Select>
      </Field>
      <Field label="Tags">
        <TagEditor
          tags={(config.triggerTags as string[]) || []}
          onChange={(tags) => onChange((d: any) => { d.triggerTags = tags.length > 0 ? tags : undefined; })}
          placeholder="Add tag"
        />
      </Field>
      <BodyJsonField value={config.body} onChange={onChange} />
      <DaprToggleField value={config.useDapr as boolean | undefined} onChange={onChange} />
      <HttpSettingsFields config={config} onChange={onChange} />
    </div>
  );
}
