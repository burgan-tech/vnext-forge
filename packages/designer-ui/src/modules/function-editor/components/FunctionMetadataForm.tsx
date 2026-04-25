import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  MetadataEditableTextInput,
  MetadataLockedTextInput,
} from '../../component-metadata';
import { Field } from '../../../ui/Field';
import { TagEditor } from '../../../ui/TagEditor';
import {
  functionMetadataFormSchema,
  type FunctionMetadataFormValues,
  toFunctionMetadataFormValues,
} from '../FunctionEditorSchema';
import { FunctionScopePicker } from './FunctionScopePicker';

interface FunctionMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function FunctionMetadataForm({ json, onChange }: FunctionMetadataFormProps) {
  const form = useForm<FunctionMetadataFormValues>({
    mode: 'onChange',
    defaultValues: toFunctionMetadataFormValues(json),
  });
  const values = useWatch({ control: form.control });

  useEffect(() => {
    const nextValues = toFunctionMetadataFormValues(json);
    const currentValues = form.getValues();

    if (JSON.stringify(nextValues) !== JSON.stringify(currentValues)) {
      form.reset(nextValues);
    }
  }, [form, json]);

  useEffect(() => {
    const parsedValues = functionMetadataFormSchema.safeParse(values);

    if (!parsedValues.success) {
      return;
    }

    /**
     * JSON'da olmayan default alanlari (orn. `scope` yoksa form 'I'
     * uretiyor) mount aninda geri yazmak, dosyayi degistirmedigimiz halde
     * editorin "Modified" gorunmesine yol aciyordu. Yalnizca form
     * degerleri JSON'un mevcut temsilinden gercekten farkliysa yaziyoruz.
     */
    const currentJsonValues = toFunctionMetadataFormValues(json);
    if (JSON.stringify(parsedValues.data) === JSON.stringify(currentJsonValues)) {
      return;
    }

    onChange((draft) => {
      draft.key = parsedValues.data.key;
      draft.version = parsedValues.data.version;
      draft.domain = parsedValues.data.domain;
      draft.flow = parsedValues.data.flow || undefined;
      draft.scope = parsedValues.data.scope;
      draft.tags = parsedValues.data.tags;
    });
  }, [json, onChange, values]);

  const keyValidation = form.register('key', {
    validate: (value) => {
      const result = functionMetadataFormSchema.shape.key.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Key is required.';
    },
  });
  const versionValidation = form.register('version', {
    validate: (value) => {
      const result = functionMetadataFormSchema.shape.version.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Version is required.';
    },
  });
  const domainValidation = form.register('domain', {
    validate: (value) => {
      const result = functionMetadataFormSchema.shape.domain.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Domain is required.';
    },
  });
  const flowValidation = form.register('flow', {
    validate: (value) => {
      const result = functionMetadataFormSchema.shape.flow.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Flow is invalid.';
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key" hint={form.formState.errors.key?.message}>
          <MetadataEditableTextInput
            {...keyValidation}
            aria-invalid={Boolean(form.formState.errors.key)}
          />
        </Field>
        <Field label="Version" hint={form.formState.errors.version?.message}>
          <MetadataEditableTextInput
            {...versionValidation}
            aria-invalid={Boolean(form.formState.errors.version)}
          />
        </Field>
        <Field label="Domain" hint={form.formState.errors.domain?.message}>
          <MetadataLockedTextInput
            {...domainValidation}
            aria-invalid={Boolean(form.formState.errors.domain)}
          />
        </Field>
        <Field label="Flow" hint={form.formState.errors.flow?.message}>
          <MetadataLockedTextInput
            {...flowValidation}
            placeholder="(optional)"
            aria-invalid={Boolean(form.formState.errors.flow)}
          />
        </Field>
      </div>

      <Controller
        control={form.control}
        name="scope"
        rules={{
          validate: (value) => {
            const result = functionMetadataFormSchema.shape.scope.safeParse(value);
            return result.success || result.error.issues[0]?.message || 'Scope is required.';
          },
        }}
        render={({ field }) => (
          <FunctionScopePicker
            value={field.value}
            onChange={(scope) => {
              field.onChange(scope);
              void form.trigger('scope');
            }}
            hint={form.formState.errors.scope?.message}
          />
        )}
      />

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

