import {
  MetadataEditableTextInput,
  MetadataLockedTextInput,
  useComponentTypeSchema,
} from '../component-metadata';
import { ComponentDescriptionField } from '../../ui/ComponentDescriptionField';
import { Field } from '../../ui/Field';
import { TagEditor } from '../../ui/TagEditor';
import { TaskTypePicker } from './components/TaskTypePicker';

interface TaskMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function TaskMetadataForm({ json, onChange }: TaskMetadataFormProps) {
  const taskType = String((json.attributes as Record<string, unknown> | undefined)?.type ?? '6');
  // `required` markers come from `@burgan-tech/vnext-schema/task` — that
  // way they always reflect the project's pinned schema version instead
  // of being hard-coded here.
  const { requiredFields } = useComponentTypeSchema('task');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key" required={requiredFields.has('key')}>
          <MetadataEditableTextInput
            value={String(json.key || '')}
            onChange={(e) => onChange((d) => { d.key = e.target.value; })}
          />
        </Field>
        <Field label="Version" required={requiredFields.has('version')}>
          <MetadataEditableTextInput
            value={String(json.version || '')}
            onChange={(e) => onChange((d) => { d.version = e.target.value; })}
          />
        </Field>
        <Field label="Domain" required={requiredFields.has('domain')}>
          <MetadataLockedTextInput value={String(json.domain || '')} />
        </Field>
        <Field label="Flow" required={requiredFields.has('flow')}>
          <MetadataLockedTextInput value={String(json.flow || '')} />
        </Field>
      </div>

      <TaskTypePicker
        value={taskType}
        onChange={(next) => {
          onChange((d) => {
            if (!d.attributes) d.attributes = {};
            (d.attributes as Record<string, unknown>).type = next;
          });
        }}
      />

      <Field label="Tags">
        <TagEditor
          tags={(json.tags as string[]) || []}
          onChange={(tags) => onChange((d) => { d.tags = tags; })}
        />
      </Field>

      <ComponentDescriptionField
        value={String(json._comment || '')}
        onChange={(value) => onChange((d) => { d._comment = value || undefined; })}
      />
    </div>
  );
}
