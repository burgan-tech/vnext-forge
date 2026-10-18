import { useEffect, useState } from 'react';

import { compareVersions } from '@vnext-forge-studio/vnext-types';

import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { JsonCodeField } from '../../../../../ui/JsonCodeField';
import { LocalizedTextMapEditor, type LocalizedTextMap } from '../../../../../ui/LocalizedTextMapEditor';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useProjectStore } from '../../../../../store/useProjectStore';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

interface XValidationCardProps {
  pointer: JsonPointer;
}

export type XValidationRuleKind =
  | 'equalsField'
  | 'notEqualsField'
  | 'maxField'
  | 'minField'
  | 'remote'
  | 'custom';

type FieldRuleKind = 'equalsField' | 'notEqualsField' | 'maxField' | 'minField';

const KIND_OPTIONS: { kind: XValidationRuleKind; label: string }[] = [
  { kind: 'equalsField', label: 'Equals field' },
  { kind: 'notEqualsField', label: 'Not equal to field' },
  { kind: 'maxField', label: 'At most field' },
  { kind: 'minField', label: 'At least field' },
  { kind: 'remote', label: 'Remote (function)' },
  { kind: 'custom', label: 'Custom (host)' },
];

/** First vnext-schema release whose vocabulary accepts `x-validation` rule `remote`. */
export const REMOTE_X_VALIDATION_MIN_SCHEMA_VERSION = '0.0.57';

/**
 * True when the project's pinned vnext-schema accepts a remote rule. Same
 * convention as `schemaRolesEnforced`: an unknown or unparseable pin
 * validates against the bundled package, so it counts as supported.
 */
export function remoteXValidationSupported(schemaVersion: string | null | undefined): boolean {
  if (!schemaVersion || !/\d+\.\d+/.test(schemaVersion)) return true;
  return compareVersions(schemaVersion, REMOTE_X_VALIDATION_MIN_SCHEMA_VERSION) >= 0;
}

/** Rule kinds to offer; a stored remote rule stays selectable on any pin. */
export function xValidationKindOptions(
  current: XValidationRuleKind,
  schemaVersion: string | null | undefined,
): { kind: XValidationRuleKind; label: string }[] {
  if (current === 'remote' || remoteXValidationSupported(schemaVersion)) return KIND_OPTIONS;
  return KIND_OPTIONS.filter((o) => o.kind !== 'remote');
}

const BUILT_IN_KINDS = new Set<string>(
  KIND_OPTIONS.filter((o) => o.kind !== 'custom').map((o) => o.kind),
);

function isFieldKind(kind: XValidationRuleKind): kind is FieldRuleKind {
  return kind !== 'remote' && kind !== 'custom';
}

export interface XValidationValue {
  kind: XValidationRuleKind;
  /** Custom rule name (kind `custom` only). */
  customRule: string;
  /** `parameters.field` of a field rule. */
  field: string;
  /**
   * `parameters` of a remote / custom rule; for a field rule, every
   * `parameters` key other than `field` (kept so a save never drops them).
   */
  parameters: unknown;
  source: string;
  resultField: string;
  messageField: string;
  trigger: 'change' | 'blur';
  /** Kept as text while editing; serialised as an integer when valid. */
  debounce: string;
  errorMessages: LocalizedTextMap;
}

const DEFAULT_VALUE = (): XValidationValue => ({
  kind: 'custom',
  customRule: '',
  field: '',
  parameters: {},
  source: '',
  resultField: '',
  messageField: '',
  trigger: 'change',
  debounce: '',
  errorMessages: {},
});

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export function toXValidationValue(value: unknown): XValidationValue {
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

  const rule = asString(record.rule);
  const kind: XValidationRuleKind = BUILT_IN_KINDS.has(rule) ? (rule as XValidationRuleKind) : 'custom';
  const parameters = 'parameters' in record ? record.parameters : {};
  const paramRecord =
    parameters && typeof parameters === 'object' && !Array.isArray(parameters)
      ? (parameters as Record<string, unknown>)
      : {};

  return {
    kind,
    customRule: kind === 'custom' ? rule : '',
    field: isFieldKind(kind) ? asString(paramRecord.field) : '',
    parameters: isFieldKind(kind) ? withoutField(paramRecord) : parameters,
    source: asString(record.source),
    resultField: asString(record.resultField),
    messageField: asString(record.messageField),
    trigger: record.trigger === 'blur' ? 'blur' : 'change',
    debounce: typeof record.debounce === 'number' ? String(record.debounce) : '',
    errorMessages: errors,
  };
}

function withoutField(record: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...record };
  delete rest.field;
  return rest;
}

const isEmptyParameters = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

export function serialize(value: XValidationValue): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (isFieldKind(value.kind)) {
    out.rule = value.kind;
    const rest =
      value.parameters && typeof value.parameters === 'object' && !Array.isArray(value.parameters)
        ? (value.parameters as Record<string, unknown>)
        : {};
    out.parameters = { ...rest, field: value.field };
  } else {
    out.rule = value.kind === 'remote' ? 'remote' : value.customRule;
    // Custom keeps today's always-present `parameters`; remote omits it when empty.
    if (value.kind === 'custom' || !isEmptyParameters(value.parameters)) {
      out.parameters = value.parameters;
    }
  }

  // The vocabulary allows these on every rule; keep whatever the value carries.
  if (value.source !== '') out.source = value.source;
  if (value.resultField !== '') out.resultField = value.resultField;
  if (value.messageField !== '') out.messageField = value.messageField;
  if (value.trigger === 'blur') out.trigger = 'blur';
  const debounce = Number(value.debounce);
  if (value.debounce.trim() !== '' && Number.isInteger(debounce) && debounce >= 0) {
    out.debounce = debounce;
  }

  if (Object.keys(value.errorMessages).length > 0) {
    out.errorMessages = value.errorMessages;
  }

  return out;
}

export const SOURCE_REQUIRED_MESSAGE = 'Function URN is required for a remote rule.';
export const RULE_REQUIRED_MESSAGE = 'Rule name is required.';

/** Required-field problems the vocabulary would reject; drives the inline errors. */
export function xValidationIssues(value: XValidationValue): { source?: string; rule?: string } {
  const issues: { source?: string; rule?: string } = {};
  if (value.kind === 'remote' && value.source.trim() === '') issues.source = SOURCE_REQUIRED_MESSAGE;
  if (value.kind === 'custom' && value.customRule.trim() === '') issues.rule = RULE_REQUIRED_MESSAGE;
  return issues;
}

/** Change the rule kind: keeps `errorMessages`, drops everything the new kind does not use. */
export function switchRuleKind(value: XValidationValue, kind: XValidationRuleKind): XValidationValue {
  return { ...DEFAULT_VALUE(), kind, errorMessages: value.errorMessages };
}

/**
 * `x-validation` declares a validation rule attached to the field: a built-in
 * sibling comparison (`equalsField`, `notEqualsField`, `maxField`, `minField`),
 * a `remote` function call, or a custom host-defined rule.
 */
export function XValidationCard({ pointer }: XValidationCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-validation', DEFAULT_VALUE);
  const current = toXValidationValue(node?.['x-validation']);
  const schemaVersion = useProjectStore((s) => s.vnextConfig?.schemaVersion);

  return (
    <VNextCardShell
      xKey="x-validation"
      title="Validation"
      purpose="Compare against a sibling field, call a function to validate remotely, or run a custom host rule; supply per-language failure text."
      enabled={enabled}
      onToggle={toggle}>
      <XValidationFields
        value={current}
        {...(schemaVersion ? { schemaVersion } : {})}
        onChange={(next) => updateComponent(setKeyword(pointer, 'x-validation', serialize(next)))}
      />
    </VNextCardShell>
  );
}

export function XValidationFields({
  value,
  onChange,
  schemaVersion,
}: {
  value: XValidationValue;
  onChange: (next: XValidationValue) => void;
  /** The project's pinned `vnext.config.json#schemaVersion`, when known. */
  schemaVersion?: string;
}) {
  const update = (patch: Partial<XValidationValue>) => onChange({ ...value, ...patch });
  const issues = xValidationIssues(value);

  return (
    <>
      <Field label="Rule">
        <Select
          value={value.kind}
          onChange={(event) => onChange(switchRuleKind(value, event.target.value as XValidationRuleKind))}>
          {xValidationKindOptions(value.kind, schemaVersion).map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      {isFieldKind(value.kind) && (
        <Field label="Field" hint="Sibling path or $instance.… expression">
          <Input
            type="text"
            value={value.field}
            onChange={(event) => update({ field: event.target.value })}
            placeholder="confirmPassword"
            inputClassName="font-mono text-sm"
          />
        </Field>
      )}

      {value.kind === 'custom' && (
        <Field
          label="Rule name"
          hint="Identifier of the validation rule registered on the host."
          errorMsg={issues.rule}>
          <Input
            type="text"
            value={value.customRule}
            onChange={(event) => update({ customRule: event.target.value })}
            placeholder="validateStatus"
            inputClassName="font-mono text-sm"
          />
        </Field>
      )}

      {value.kind === 'remote' && (
        <Field
          label="Function"
          hint="URN of the function that validates the value."
          errorMsg={issues.source}>
          <Input
            type="text"
            value={value.source}
            onChange={(event) => update({ source: event.target.value })}
            placeholder="urn:vnext:fn:<domain>:<function>"
            inputClassName="font-mono text-sm"
          />
        </Field>
      )}

      {(value.kind === 'remote' || value.kind === 'custom') && (
        <ParametersField value={value.parameters} onChange={(next) => update({ parameters: next })} />
      )}

      {value.kind === 'remote' && (
        <>
          <Field label="Result field" hint="Path of the boolean verdict in the response.">
            <Input
              type="text"
              value={value.resultField}
              onChange={(event) => update({ resultField: event.target.value })}
              placeholder="$.valid"
              inputClassName="font-mono text-sm"
            />
          </Field>
          <Field label="Message field" hint="Optional path of a failure message in the response.">
            <Input
              type="text"
              value={value.messageField}
              onChange={(event) => update({ messageField: event.target.value })}
              placeholder="$.message"
              inputClassName="font-mono text-sm"
            />
          </Field>
          <Field label="Trigger">
            <Select
              value={value.trigger}
              onChange={(event) => update({ trigger: event.target.value === 'blur' ? 'blur' : 'change' })}>
              <option value="change">change</option>
              <option value="blur">blur</option>
            </Select>
          </Field>
          <Field label="Debounce (ms)">
            <Input
              type="number"
              value={value.debounce}
              onChange={(event) => update({ debounce: event.target.value })}
              placeholder="400"
              inputClassName="font-mono text-sm"
            />
          </Field>
        </>
      )}

      <Field label="Error messages" hint="Per-language text shown when the rule fails.">
        <LocalizedTextMapEditor
          label="Messages"
          value={value.errorMessages}
          onChange={(next) => update({ errorMessages: next })}
        />
      </Field>
    </>
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
      hint="JSON object forwarded to the rule. For remote rules, values may be literals or $value / $instance.* / $form.* expressions. Invalid JSON is kept locally until it parses."
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
