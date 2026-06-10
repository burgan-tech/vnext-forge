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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import {
  mappingMetadataFormSchema,
  type MappingMetadataFormValues,
  toMappingMetadataFormValues,
} from '../MappingEditorSchema';

interface MappingMetadataFormProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

/**
 * Top metadata card for the Mapping (sys-mappings) editor — mirrors
 * the `FunctionMetadataForm` / `ExtensionMetadataForm` pattern so the
 * Mapping editor is visually consistent with every other atomic
 * component editor in the designer.
 *
 * Edits root-level fields (`key`, `version`, `domain`, `flowVersion`,
 * `tags`, `_comment`). `flow` is locked to the literal `sys-mappings`
 * — the mapping editor cannot author any other flow.
 */
export function MappingMetadataForm({ json, onChange }: MappingMetadataFormProps) {
  const { requiredFields } = useComponentTypeSchema('mapping');
  const keyServerError = useFieldValidationError('key');
  const versionServerError = useFieldValidationError('version');
  const domainServerError = useFieldValidationError('domain');
  const flowServerError = useFieldValidationError('flow');
  const flowVersionServerError = useFieldValidationError('flowVersion');

  const form = useForm<MappingMetadataFormValues>({
    mode: 'onChange',
    defaultValues: toMappingMetadataFormValues(json),
  });
  const values = useWatch({ control: form.control });

  // Re-sync the form when the external JSON changes (file reload,
  // undo/redo, etc.) so the inputs reflect persisted state.
  useEffect(() => {
    const nextValues = toMappingMetadataFormValues(json);
    const currentValues = form.getValues();
    if (JSON.stringify(nextValues) !== JSON.stringify(currentValues)) {
      form.reset(nextValues);
    }
  }, [form, json]);

  // Mirror form edits back into the component store. Skip when the
  // form already matches the JSON (avoids spurious "Modified" marks
  // on mount from defaulted fields).
  useEffect(() => {
    const parsedValues = mappingMetadataFormSchema.safeParse(values);
    if (!parsedValues.success) return;

    const currentJsonValues = toMappingMetadataFormValues(json);
    if (JSON.stringify(parsedValues.data) === JSON.stringify(currentJsonValues)) {
      return;
    }

    onChange((draft) => {
      draft.key = parsedValues.data.key;
      draft.version = parsedValues.data.version;
      draft.domain = parsedValues.data.domain;
      // `flow` is locked to the literal — always write it so legacy
      // files missing the field get repaired on first edit.
      draft.flow = 'sys-mappings';
      draft.flowVersion = parsedValues.data.flowVersion;
      draft.tags = parsedValues.data.tags;
      const trimmedComment = parsedValues.data._comment?.trim() ?? '';
      if (trimmedComment) {
        draft._comment = trimmedComment;
      } else {
        delete draft._comment;
      }
    });
  }, [json, onChange, values]);

  const keyValidation = form.register('key', {
    validate: (value) => {
      const result = mappingMetadataFormSchema.shape.key.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Key is required.';
    },
  });
  const versionValidation = form.register('version', {
    validate: (value) => {
      const result = mappingMetadataFormSchema.shape.version.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Version is required.';
    },
  });
  const domainValidation = form.register('domain', {
    validate: (value) => {
      const result = mappingMetadataFormSchema.shape.domain.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Domain is required.';
    },
  });
  const flowVersionValidation = form.register('flowVersion', {
    validate: (value) => {
      const result = mappingMetadataFormSchema.shape.flowVersion.safeParse(value);
      return result.success || result.error.issues[0]?.message || 'Flow version is required.';
    },
  });

  return (
    <Card variant="default" className="gap-3">
      <CardHeader className="border-border border-b">
        <CardTitle className="text-sm">Mapping</CardTitle>
        <CardDescription className="text-xs">
          Root metadata for this sys-mappings component.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Key"
              required={requiredFields.has('key')}
              errorMsg={form.formState.errors.key?.message || keyServerError}>
              <MetadataEditableTextInput
                {...keyValidation}
                aria-invalid={Boolean(form.formState.errors.key) || Boolean(keyServerError)}
              />
            </Field>
            <Field
              label="Version"
              required={requiredFields.has('version')}
              errorMsg={form.formState.errors.version?.message || versionServerError}>
              <MetadataEditableTextInput
                {...versionValidation}
                aria-invalid={Boolean(form.formState.errors.version) || Boolean(versionServerError)}
              />
            </Field>
            <Field
              label="Domain"
              required={requiredFields.has('domain')}
              errorMsg={form.formState.errors.domain?.message || domainServerError}>
              <MetadataLockedTextInput
                {...domainValidation}
                aria-invalid={Boolean(form.formState.errors.domain) || Boolean(domainServerError)}
              />
            </Field>
            <Field
              label="Flow"
              required={requiredFields.has('flow')}
              errorMsg={flowServerError}>
              <MetadataLockedTextInput
                value="sys-mappings"
                readOnly
                aria-invalid={Boolean(flowServerError)}
              />
            </Field>
            <Field
              label="Flow version"
              required={requiredFields.has('flowVersion')}
              errorMsg={form.formState.errors.flowVersion?.message || flowVersionServerError}>
              <MetadataEditableTextInput
                {...flowVersionValidation}
                aria-invalid={
                  Boolean(form.formState.errors.flowVersion) || Boolean(flowVersionServerError)
                }
              />
            </Field>
          </div>

          <Controller
            control={form.control}
            name="tags"
            render={({ field }) => (
              <Field
                label="Tags"
                required={requiredFields.has('tags')}
                errorMsg={form.formState.errors.tags?.message}>
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

          <Controller
            control={form.control}
            name="_comment"
            render={({ field }) => (
              <Field label="Comment">
                <textarea
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder="Optional comment about this mapping..."
                  rows={2}
                  aria-label="Mapping comment"
                  className="border-border bg-muted-surface text-foreground focus:ring-ring/20 focus:border-primary-border focus:bg-surface placeholder:text-subtle w-full resize-y rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-all focus:outline-none focus:ring-2"
                />
              </Field>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
