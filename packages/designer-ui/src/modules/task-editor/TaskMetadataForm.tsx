import {
  MetadataEditableTextInput,
  MetadataLockedTextInput,
  useComponentTypeSchema,
  useFieldValidationError,
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
  // Save-time validation errors per field — populated when the user
  // tries to save and the baseline / server-side AJV catches an issue.
  const keyError = useFieldValidationError('key');
  const versionError = useFieldValidationError('version');
  const domainError = useFieldValidationError('domain');
  const flowError = useFieldValidationError('flow');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key" required={requiredFields.has('key')} hint={keyError}>
          <MetadataEditableTextInput
            value={String(json.key || '')}
            onChange={(e) => onChange((d) => { d.key = e.target.value; })}
            aria-invalid={keyError ? true : undefined}
          />
        </Field>
        <Field label="Version" required={requiredFields.has('version')} hint={versionError}>
          <MetadataEditableTextInput
            value={String(json.version || '')}
            onChange={(e) => onChange((d) => { d.version = e.target.value; })}
            aria-invalid={versionError ? true : undefined}
          />
        </Field>
        <Field label="Domain" required={requiredFields.has('domain')} hint={domainError}>
          <MetadataLockedTextInput
            value={String(json.domain || '')}
            aria-invalid={domainError ? true : undefined}
          />
        </Field>
        <Field label="Flow" required={requiredFields.has('flow')} hint={flowError}>
          <MetadataLockedTextInput
            value={String(json.flow || '')}
            aria-invalid={flowError ? true : undefined}
          />
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
