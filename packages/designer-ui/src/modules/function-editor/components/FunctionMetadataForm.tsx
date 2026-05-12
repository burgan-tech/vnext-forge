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
  // `required` markers come from `@burgan-tech/vnext-schema/function`
  // matching the project's pinned schema version (or bundled fallback).
  const { requiredFields } = useComponentTypeSchema('function');
  // Save-time validation errors → aria-invalid + hint message.
  const keyServerError = useFieldValidationError('key');
  const versionServerError = useFieldValidationError('version');
  const domainServerError = useFieldValidationError('domain');
  const flowServerError = useFieldValidationError('flow');
  // scope/tags/etc. server errors aren't wired yet — picker components
  // own their own aria-invalid path; revisit when scope picker accepts
  // an error prop.
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
      draft.tags = parsedValues.data.tags;

      const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
      attrs.scope = parsedValues.data.scope;
      draft.attributes = attrs;
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
        <Field
          label="Key"
          required={requiredFields.has('key')}
          errorMsg={form.formState.errors.key?.message || keyServerError}
        >
          <MetadataEditableTextInput
            {...keyValidation}
            aria-invalid={Boolean(form.formState.errors.key) || Boolean(keyServerError)}
          />
        </Field>
        <Field
          label="Version"
          required={requiredFields.has('version')}
          errorMsg={form.formState.errors.version?.message || versionServerError}
        >
          <MetadataEditableTextInput
            {...versionValidation}
            aria-invalid={Boolean(form.formState.errors.version) || Boolean(versionServerError)}
          />
        </Field>
        <Field
          label="Domain"
          required={requiredFields.has('domain')}
          errorMsg={form.formState.errors.domain?.message || domainServerError}
        >
          <MetadataLockedTextInput
            {...domainValidation}
            aria-invalid={Boolean(form.formState.errors.domain) || Boolean(domainServerError)}
          />
        </Field>
        <Field
          label="Flow"
          required={requiredFields.has('flow')}
          errorMsg={form.formState.errors.flow?.message || flowServerError}
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
          <Field label="Tags" errorMsg={form.formState.errors.tags?.message}>
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

