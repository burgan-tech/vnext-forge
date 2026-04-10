import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Field } from '@modules/save-component/components/Field';
import { TagEditor } from '@modules/save-component/components/TagEditor';
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

    onChange((draft) => {
      draft.key = parsedValues.data.key;
      draft.version = parsedValues.data.version;
      draft.domain = parsedValues.data.domain;
      draft.flow = parsedValues.data.flow || undefined;
      draft.scope = parsedValues.data.scope;
      draft.tags = parsedValues.data.tags;
    });
  }, [onChange, values]);

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
      <div className="text-xs font-medium">Function Metadata</div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Key" hint={form.formState.errors.key?.message}>
          <input
            type="text"
            {...keyValidation}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        </Field>
        <Field label="Version" hint={form.formState.errors.version?.message}>
          <input
            type="text"
            {...versionValidation}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        </Field>
        <Field label="Domain" hint={form.formState.errors.domain?.message}>
          <input
            type="text"
            {...domainValidation}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
          />
        </Field>
        <Field label="Flow" hint={form.formState.errors.flow?.message}>
          <input
            type="text"
            {...flowValidation}
            placeholder="(optional)"
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
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
