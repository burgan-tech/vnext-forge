import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Field } from '@shared/ui/Field';
import { Input } from '@shared/ui/Input';
import { TagEditor } from '@shared/ui/TagEditor';
import {
  schemaMetadataFormSchema,
  type SchemaMetadataFormValues,
  toSchemaMetadataFormValues,
} from '../SchemaEditorSchema';

interface SchemaMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function SchemaMetadataForm({ json, onChange }: SchemaMetadataFormProps) {
  const form = useForm<SchemaMetadataFormValues>({
    mode: 'onChange',
    defaultValues: toSchemaMetadataFormValues(json),
  });
  const values = useWatch({ control: form.control });

  useEffect(() => {
    const nextValues = toSchemaMetadataFormValues(json);
    const currentValues = form.getValues();

    if (JSON.stringify(nextValues) !== JSON.stringify(currentValues)) {
      form.reset(nextValues);
    }
  }, [form, json]);

  useEffect(() => {
    const parsedValues = schemaMetadataFormSchema.safeParse(values);

    if (!parsedValues.success) {
      return;
    }

    onChange((draft) => {
      draft.key = parsedValues.data.key;
      draft.version = parsedValues.data.version;
      draft.domain = parsedValues.data.domain;
      draft.flow = parsedValues.data.flow || undefined;
      draft.tags = parsedValues.data.tags;
    });
  }, [onChange, values]);

  const keyValidation = form.register('key', {
    validate: (value) => {
      const result = schemaMetadataFormSchema.shape.key.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Key is required.';
    },
  });
  const versionValidation = form.register('version', {
    validate: (value) => {
      const result = schemaMetadataFormSchema.shape.version.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Version is required.';
    },
  });
  const domainValidation = form.register('domain', {
    validate: (value) => {
      const result = schemaMetadataFormSchema.shape.domain.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Domain is required.';
    },
  });
  const flowValidation = form.register('flow', {
    validate: (value) => {
      const result = schemaMetadataFormSchema.shape.flow.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Flow is invalid.';
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key" hint={form.formState.errors.key?.message}>
          <Input
            type="text"
            {...keyValidation}
            readOnly
            variant="muted"
            className="w-full"
            inputClassName="font-mono text-xs"
            aria-invalid={Boolean(form.formState.errors.key)}
          />
        </Field>
        <Field label="Version" hint={form.formState.errors.version?.message}>
          <Input
            type="text"
            {...versionValidation}
            className="w-full"
            inputClassName="font-mono text-xs"
            aria-invalid={Boolean(form.formState.errors.version)}
          />
        </Field>
        <Field label="Domain" hint={form.formState.errors.domain?.message}>
          <Input
            type="text"
            {...domainValidation}
            className="w-full"
            inputClassName="font-mono text-xs"
            aria-invalid={Boolean(form.formState.errors.domain)}
          />
        </Field>
        <Field label="Flow" hint={form.formState.errors.flow?.message}>
          <Input
            type="text"
            {...flowValidation}
            placeholder="(optional)"
            className="w-full"
            inputClassName="font-mono text-xs"
            aria-invalid={Boolean(form.formState.errors.flow)}
          />
        </Field>
      </div>

      <Controller
        control={form.control}
        name="tags"
        render={({ field }) => (
          <Field label="Tags" hint={form.formState.errors.tags?.message}>
            <TagEditor
              tags={field.value}
              onChange={(tags) => {
                field.onChange(tags);
                void form.trigger('tags');
              }}
            />
          </Field>
        )}
      />
    </div>
  );
}
