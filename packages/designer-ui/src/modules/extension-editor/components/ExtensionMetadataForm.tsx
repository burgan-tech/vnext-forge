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
  extensionMetadataFormSchema,
  type ExtensionMetadataFormValues,
  toExtensionMetadataFormValues,
} from '../ExtensionEditorSchema';
import { ExtensionTypePicker } from './ExtensionTypePicker';
import { ExtensionScopePicker } from './ExtensionScopePicker';
import { DefinedFlowsSelector } from './DefinedFlowsSelector';

interface ExtensionMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function ExtensionMetadataForm({ json, onChange }: ExtensionMetadataFormProps) {
  // `required` markers come from `@burgan-tech/vnext-schema/extension`
  // matching the project's pinned schema version (or bundled fallback).
  const { requiredFields } = useComponentTypeSchema('extension');
  // Save-time validation errors → aria-invalid + hint message.
  const keyServerError = useFieldValidationError('key');
  const versionServerError = useFieldValidationError('version');
  const domainServerError = useFieldValidationError('domain');
  const flowServerError = useFieldValidationError('flow');
  const form = useForm<ExtensionMetadataFormValues>({
    mode: 'onChange',
    defaultValues: toExtensionMetadataFormValues(json),
  });
  const values = useWatch({ control: form.control });

  useEffect(() => {
    const nextValues = toExtensionMetadataFormValues(json);
    const currentValues = form.getValues();

    if (JSON.stringify(nextValues) !== JSON.stringify(currentValues)) {
      form.reset(nextValues);
    }
  }, [form, json]);

  useEffect(() => {
    const parsed = extensionMetadataFormSchema.safeParse(values);
    if (!parsed.success) return;

    /**
     * JSON'da olmayan default alanlari (orn. `scope`/`type` yoksa form
     * fallback uretiyor) mount aninda geri yazmak, dosyayi degistirmedigimiz
     * halde editorin "Modified" gorunmesine yol aciyordu. Yalnizca form
     * degerleri JSON'un mevcut temsilinden gercekten farkliysa yaziyoruz.
     */
    const currentJsonValues = toExtensionMetadataFormValues(json);
    if (JSON.stringify(parsed.data) === JSON.stringify(currentJsonValues)) {
      return;
    }

    onChange((draft) => {
      draft.key = parsed.data.key;
      draft.version = parsed.data.version;
      draft.domain = parsed.data.domain;
      draft.flow = parsed.data.flow || undefined;
      draft.tags = parsed.data.tags;

      const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
      attrs.type = parsed.data.type;
      attrs.scope = parsed.data.scope;
      if (parsed.data.definedFlows.length > 0) {
        attrs.definedFlows = parsed.data.definedFlows;
      } else {
        delete attrs.definedFlows;
      }
      draft.attributes = attrs;
    });
  }, [json, onChange, values]);

  const keyValidation = form.register('key', {
    validate: (value) => {
      const result = extensionMetadataFormSchema.shape.key.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Key is required.';
    },
  });
  const versionValidation = form.register('version', {
    validate: (value) => {
      const result = extensionMetadataFormSchema.shape.version.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Version is required.';
    },
  });
  const domainValidation = form.register('domain', {
    validate: (value) => {
      const result = extensionMetadataFormSchema.shape.domain.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Domain is required.';
    },
  });
  const flowValidation = form.register('flow', {
    validate: (value) => {
      const result = extensionMetadataFormSchema.shape.flow.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Flow is invalid.';
    },
  });

  const showDefinedFlows = values.type === 3 || values.type === 4;

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

      <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch md:gap-5">
        <Controller
          control={form.control}
          name="type"
          rules={{
            validate: (value) => {
              const result = extensionMetadataFormSchema.shape.type.safeParse(value);
              return result.success || result.error.issues[0]?.message || 'Type is required.';
            },
          }}
          render={({ field }) => (
            <ExtensionTypePicker
              value={field.value}
              onChange={(type) => {
                field.onChange(type);
                void form.trigger('type');
              }}
              hint={form.formState.errors.type?.message}
            />
          )}
        />

        <Controller
          control={form.control}
          name="scope"
          rules={{
            validate: (value) => {
              const result = extensionMetadataFormSchema.shape.scope.safeParse(value);
              return result.success || result.error.issues[0]?.message || 'Scope is required.';
            },
          }}
          render={({ field }) => (
            <ExtensionScopePicker
              value={field.value}
              onChange={(scope) => {
                field.onChange(scope);
                void form.trigger('scope');
              }}
              hint={form.formState.errors.scope?.message}
            />
          )}
        />
      </div>

      {showDefinedFlows && (
        <Controller
          control={form.control}
          name="definedFlows"
          render={({ field }) => (
            <DefinedFlowsSelector flows={field.value} onChange={(flows) => field.onChange(flows)} />
          )}
        />
      )}

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
