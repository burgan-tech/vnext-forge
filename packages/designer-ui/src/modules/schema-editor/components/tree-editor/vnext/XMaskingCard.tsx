import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { fieldProtectionIssues } from '../../../model/fieldProtection';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { RoleGrantListEditor, normalizeRoleEntries } from './RoleGrantListEditor';
import { VNextCardShell } from './VNextCardShell';

type MaskingOperator = 'mask' | 'replace';
type MaskingValue = Record<string, unknown>;

const DEFAULT_VALUE = (): MaskingValue => ({ operator: 'mask', params: { keepLast: 4 } });

/** Switches the operator, keeping only the params that operator accepts. */
export function withMaskingOperator(current: MaskingValue, operator: MaskingOperator): MaskingValue {
  const next: MaskingValue = { ...current, operator };
  const params = (current.params && typeof current.params === 'object' ? current.params : {}) as Record<string, unknown>;
  if (operator === 'replace') {
    next.params = { value: typeof params.value === 'string' && params.value ? params.value : '***' };
  } else {
    const kept: Record<string, unknown> = {};
    for (const k of ['maskingChar', 'keepFirst', 'keepLast'] as const) if (params[k] !== undefined) kept[k] = params[k];
    if (Object.keys(kept).length > 0) next.params = kept;
    else delete next.params;
  }
  return next;
}

interface XMaskingCardProps {
  pointer: JsonPointer;
}

/**
 * `x-masking` (vnext-schema 0.0.55 / runtime 0.0.99): every read surface
 * (instance GET and list, data function, sync responses, Get* tasks) shows a
 * masked value to callers outside the allow-only `roles`.
 *  - `mask`    keeps `keepFirst` / `keepLast` characters, replaces the rest
 *              with `maskingChar` (default `*`), length preserved;
 *  - `replace` replaces the whole value with `params.value`.
 */
export function XMaskingCard({ pointer }: XMaskingCardProps) {
  const { node } = useSchemaNode(pointer);
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-masking', DEFAULT_VALUE);

  const stored = node?.['x-masking'];
  const value: MaskingValue = stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as MaskingValue) : {};
  const operator: MaskingOperator = value.operator === 'replace' ? 'replace' : 'mask';
  const params = (value.params && typeof value.params === 'object' ? value.params : {}) as Record<string, unknown>;
  const issues = enabled ? fieldProtectionIssues(componentJson, pointer, 'x-masking') : [];

  const write = (next: MaskingValue) => updateComponent(setKeyword(pointer, 'x-masking', next));
  const patchParam = (field: string, fieldValue: unknown) => {
    const nextParams = { ...params };
    if (fieldValue === undefined || fieldValue === '') delete nextParams[field];
    else nextParams[field] = fieldValue;
    const next = { ...value };
    if (Object.keys(nextParams).length > 0) next.params = nextParams;
    else delete next.params;
    write(next);
  };
  const intParam = (raw: string) => {
    const n = Number(raw);
    return raw !== '' && Number.isInteger(n) && n >= 0 ? n : undefined;
  };

  return (
    <VNextCardShell
      xKey="x-masking"
      title="Masking"
      purpose="Show a masked value to every caller outside the exempt roles. Applied after x-roles, before x-encryption."
      enabled={enabled}
      onToggle={toggle}
      error={
        issues.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : undefined
      }>
      <Field label="Operator">
        <Select
          className="h-8 text-xs"
          value={operator}
          onChange={(event) => write(withMaskingOperator(value, event.target.value as MaskingOperator))}>
          <option value="mask">mask — keep the ends, hide the rest</option>
          <option value="replace">replace — show a fixed text</option>
        </Select>
      </Field>

      {operator === 'mask' ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Keep first">
            <Input
              type="number"
              min={0}
              value={typeof params.keepFirst === 'number' ? params.keepFirst : ''}
              onChange={(event) => patchParam('keepFirst', intParam(event.target.value))}
              placeholder="0"
              inputClassName="text-xs"
            />
          </Field>
          <Field label="Keep last">
            <Input
              type="number"
              min={0}
              value={typeof params.keepLast === 'number' ? params.keepLast : ''}
              onChange={(event) => patchParam('keepLast', intParam(event.target.value))}
              placeholder="0"
              inputClassName="text-xs"
            />
          </Field>
          <Field label="Masking char">
            <Input
              type="text"
              maxLength={1}
              value={typeof params.maskingChar === 'string' ? params.maskingChar : ''}
              onChange={(event) => patchParam('maskingChar', event.target.value || undefined)}
              placeholder="*"
              inputClassName="font-mono text-xs"
            />
          </Field>
        </div>
      ) : (
        <Field label="Replacement" required>
          <Input
            type="text"
            value={typeof params.value === 'string' ? params.value : ''}
            onChange={(event) => patchParam('value', event.target.value || undefined)}
            inputClassName="font-mono text-xs"
          />
        </Field>
      )}

      <Field label="Callers who see the raw value">
        <RoleGrantListEditor
          allowOnly
          roles={normalizeRoleEntries(value.roles, { allowOnly: true })}
          onChange={(next) => {
            const nextValue = { ...value };
            if (next.length > 0) nextValue.roles = next;
            else delete nextValue.roles;
            write(nextValue);
          }}
        />
      </Field>
    </VNextCardShell>
  );
}
