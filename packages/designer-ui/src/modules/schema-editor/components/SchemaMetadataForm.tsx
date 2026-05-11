import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  MetadataEditableTextInput,
  MetadataLockedTextInput,
  useComponentTypeSchema,
  useFieldValidationError,
} from '../../component-metadata';
import { Field } from '../../../ui/Field';
import { TagEditor } from '../../../ui/TagEditor';
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
  // Schema-driven required markers — pulled from
  // `@burgan-tech/vnext-schema/schema` matching the project's pinned
  // `vnext.config.json#schemaVersion` (or bundled fallback).
  const { requiredFields } = useComponentTypeSchema('schema');
  // Save-time validation errors merged into the form below so the
  // matching inputs render with aria-invalid (red border via global CSS).
  const keyServerError = useFieldValidationError('key');
  const versionServerError = useFieldValidationError('version');
  const domainServerError = useFieldValidationError('domain');
  const flowServerError = useFieldValidationError('flow');
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

    /**
     * JSON'da olmayan default alanlari mount aninda geri yazmak, dosyayi
     * degistirmedigimiz halde editorin "Modified" gorunmesine yol aciyordu.
     * Yalnizca form degerleri JSON'un mevcut temsilinden gercekten
     * farkliysa yaziyoruz.
     */
    const currentJsonValues = toSchemaMetadataFormValues(json);
    if (JSON.stringify(parsedValues.data) === JSON.stringify(currentJsonValues)) {
      return;
    }

    onChange((draft) => {
      draft.key = parsedValues.data.key;
      draft.version = parsedValues.data.version;
      draft.domain = parsedValues.data.domain;
      draft.flow = parsedValues.data.flow || undefined;
      draft.tags = parsedValues.data.tags;
    });
  }, [json, onChange, values]);

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
        <Field
          label="Key"
          required={requiredFields.has('key')}
          hint={form.formState.errors.key?.message || keyServerError}
        >
          <MetadataEditableTextInput
            {...keyValidation}
            aria-invalid={Boolean(form.formState.errors.key) || Boolean(keyServerError)}
          />
        </Field>
        <Field
          label="Version"
          required={requiredFields.has('version')}
          hint={form.formState.errors.version?.message || versionServerError}
        >
          <MetadataEditableTextInput
            {...versionValidation}
            aria-invalid={Boolean(form.formState.errors.version) || Boolean(versionServerError)}
          />
        </Field>
        <Field
          label="Domain"
          required={requiredFields.has('domain')}
          hint={form.formState.errors.domain?.message || domainServerError}
        >
          <MetadataLockedTextInput
            {...domainValidation}
            aria-invalid={Boolean(form.formState.errors.domain) || Boolean(domainServerError)}
          />
        </Field>
        <Field
          label="Flow"
          required={requiredFields.has('flow')}
          hint={form.formState.errors.flow?.message || flowServerError}
        >
          <MetadataLockedTextInput
            {...flowValidation}
            placeholder="(optional)"
            aria-invalid={Boolean(form.formState.errors.flow) || Boolean(flowServerError)}
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
