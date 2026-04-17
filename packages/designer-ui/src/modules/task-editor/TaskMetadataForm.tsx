import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { TagEditor } from '../../ui/TagEditor';

interface TaskMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function TaskMetadataForm({ json, onChange }: TaskMetadataFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key">
          <Input
            type="text"
            value={String(json.key || '')}
            readOnly
            hoverable={false}
            size="sm"
            variant="muted"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field label="Version">
          <Input
            type="text"
            value={String(json.version || '')}
            onChange={(e) => onChange((d) => { d.version = e.target.value; })}
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field label="Domain">
          <Input
            type="text"
            value={String(json.domain || '')}
            onChange={(e) => onChange((d) => { d.domain = e.target.value; })}
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field label="Flow">
          <Input
            type="text"
            value={String(json.flow || '')}
            onChange={(e) => onChange((d) => { d.flow = e.target.value; })}
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
      </div>
      <Field label="Task Type">
        <Select
          value={String((json.attributes as any)?.type || '6')}
          onChange={(e) => onChange((d) => {
            if (!d.attributes) d.attributes = {};
            (d.attributes as any).type = e.target.value;
          })}
          className="text-xs"
        >
          <option value="3">Dapr Service Invocation</option>
          <option value="4">Dapr PubSub</option>
          <option value="5">Script (C#)</option>
          <option value="6">HTTP Request</option>
          <option value="7">Dapr Binding</option>
          <option value="11">Start Workflow</option>
          <option value="12">Direct Trigger</option>
          <option value="13">Get Instance Data</option>
          <option value="14">SubProcess / Start Trigger</option>
          <option value="15">Get Instances</option>
        </Select>
      </Field>
      <Field label="Tags">
        <TagEditor
          tags={(json.tags as string[]) || []}
          onChange={(tags) => onChange((d) => { d.tags = tags; })}
        />
      </Field>
    </div>
  );
}

