import { Field } from '../../../ui/Field';
import { Select } from '../../../ui/Select';
import { TagEditor } from '../../../ui/TagEditor';

interface Props {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

export function NotificationTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="Channels">
        <TagEditor
          tags={(config.channels as string[]) || []}
          onChange={(channels) => onChange((d: any) => {
            d.channels = channels.length > 0 ? channels : undefined;
          })}
          placeholder="Add channel, e.g. sms, email, push"
        />
      </Field>
      <Field label="Include State Channel">
        <Select
          value={config.includeStateChannel === false ? 'false' : 'true'}
          onChange={(e) => onChange((d: any) => {
            d.includeStateChannel = e.target.value === 'true';
          })}
          className="text-xs">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </Field>
    </div>
  );
}
