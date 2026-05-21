import { useEffect, useState } from 'react';

import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { JsonCodeField } from '../../../../../ui/JsonCodeField';
import { LocalizedTextMapEditor, type LocalizedTextMap } from '../../../../../ui/LocalizedTextMapEditor';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

interface XValidationCardProps {
  pointer: JsonPointer;
}

interface XValidationValue {
  rule: string;
  parameters: unknown;
  errorMessages: LocalizedTextMap;
}

const DEFAULT_VALUE = (): XValidationValue => ({
  rule: '',
  parameters: {},
  errorMessages: {},
});

function toXValidationValue(value: unknown): XValidationValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_VALUE();
  }

  const record = value as Record<string, unknown>;
  const errorRaw = record.errorMessages;
  const errors: LocalizedTextMap = {};

  if (errorRaw && typeof errorRaw === 'object' && !Array.isArray(errorRaw)) {
    for (const [lang, text] of Object.entries(errorRaw)) {
      if (typeof text === 'string') {
        errors[lang] = text;
      }
    }
  }

  return {
    rule: typeof record.rule === 'string' ? record.rule : '',
    parameters: 'parameters' in record ? record.parameters : {},
    errorMessages: errors,
  };
}

function serialize(value: XValidationValue): Record<string, unknown> {
  const out: Record<string, unknown> = {
    rule: value.rule,
    parameters: value.parameters,
  };

  if (Object.keys(value.errorMessages).length > 0) {
    out.errorMessages = value.errorMessages;
  }

  return out;
}

/**
 * `x-validation` declares a custom backend validation rule attached to
 * the field. Persisted shape: `{ rule, parameters, errorMessages? }`.
 * Parameters can be any JSON value; the field accepts arbitrary JSON and
 * keeps the previous parsed value while the input is being typed.
 */
export function XValidationCard({ pointer }: XValidationCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-validation', DEFAULT_VALUE);
  const current = toXValidationValue(node?.['x-validation']);

  function update(patch: Partial<XValidationValue>) {
    updateComponent(setKeyword(pointer, 'x-validation', serialize({ ...current, ...patch })));
  }

  return (
    <VNextCardShell
      xKey="x-validation"
      title="Custom validation"
      purpose="Run a named backend validation rule with parameters; supply per-language failure text."
      enabled={enabled}
      onToggle={toggle}>
      <Field label="Rule" hint="Identifier of the validation rule registered on the server.">
        <Input
          type="text"
          value={current.rule}
          onChange={(event) => update({ rule: event.target.value })}
          placeholder="validateStatus"
          inputClassName="font-mono text-sm"
        />
      </Field>

      <ParametersField
        value={current.parameters}
        onChange={(next) => update({ parameters: next })}
      />

      <Field label="Error messages" hint="Per-language text shown when the rule fails.">
        <LocalizedTextMapEditor
          label="Messages"
          value={current.errorMessages}
          onChange={(next) => update({ errorMessages: next })}
        />
      </Field>
    </VNextCardShell>
  );
}

function ParametersField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const initial = JSON.stringify(value ?? {}, null, 2);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(JSON.stringify(value ?? {}, null, 2));
    setError(null);
  }, [value]);

  return (
    <Field
      label="Parameters"
      hint="JSON object forwarded to the rule. Invalid JSON is kept locally until it parses."
      errorMsg={error}>
      <JsonCodeField
        value={draft}
        height={140}
        onChange={(next) => {
          setDraft(next);

          if (next.trim() === '') {
            setError(null);
            onChange({});
            return;
          }

          try {
            const parsed: unknown = JSON.parse(next);
            setError(null);
            onChange(parsed);
          } catch {
            setError('Parameters must be valid JSON.');
          }
        }}
      />
    </Field>
  );
}
