import { Checkbox } from '../../../../../ui/Checkbox';
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

const ENCRYPTION_TYPES = ['none', 'hash', 'encrypt'] as const;
type EncryptionType = (typeof ENCRYPTION_TYPES)[number];

/** Pre-0.0.99 values: never enforced, rejected at publish since 0.0.99. */
const LEGACY_TYPES = ['transport', 'persisted'] as const;

const TYPE_LABELS: Record<EncryptionType, string> = {
  none: 'none — metadata only',
  hash: 'hash — one-way HMAC on write',
  encrypt: 'encrypt — AES-256-GCM at rest',
};

const DEFAULT_VALUE = (): Record<string, unknown> => ({ type: 'encrypt' });

type EncryptionValue = Record<string, unknown>;

/**
 * Rebuilds `x-encryption` for a new `type`, dropping what the vocabulary does
 * not allow there: `params` only on `hash`, `roles` never on `hash`.
 */
export function withEncryptionType(current: EncryptionValue, type: EncryptionType): EncryptionValue {
  const next: EncryptionValue = { ...current, type };
  if (type !== 'hash') delete next.params;
  if (type === 'hash') delete next.roles;
  if (type === 'none') delete next.roles;
  return next;
}

interface XEncryptionCardProps {
  pointer: JsonPointer;
}

/**
 * `x-encryption` (vnext-schema 0.0.55 / runtime 0.0.99):
 *  - `none`    metadata only;
 *  - `hash`    applied on write, stored and served as `HASHED:SHA256:<hex>`;
 *              `params.algorithm` sha256 | sha512; no roles;
 *  - `encrypt` stored as `ENCRYPTED:AES256:i1:…`; allow-only `roles` get
 *              plaintext on the data function and sync responses.
 * `purpose`, `redactInLogs` and `retentionDays` are governance metadata.
 */
export function XEncryptionCard({ pointer }: XEncryptionCardProps) {
  const { node } = useSchemaNode(pointer);
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-encryption', DEFAULT_VALUE);

  const stored = node?.['x-encryption'];
  const value: EncryptionValue = stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as EncryptionValue) : {};
  const rawType = typeof value.type === 'string' ? value.type : 'none';
  const legacy = (LEGACY_TYPES as readonly string[]).includes(rawType);
  const type = (ENCRYPTION_TYPES as readonly string[]).includes(rawType) ? (rawType as EncryptionType) : null;
  const params = (value.params && typeof value.params === 'object' ? value.params : {}) as Record<string, unknown>;
  const issues = enabled ? fieldProtectionIssues(componentJson, pointer, 'x-encryption') : [];

  const write = (next: EncryptionValue) => updateComponent(setKeyword(pointer, 'x-encryption', next));
  const patch = (field: string, fieldValue: unknown) => {
    const next = { ...value };
    if (fieldValue === undefined || fieldValue === '') delete next[field];
    else next[field] = fieldValue;
    write(next);
  };

  return (
    <VNextCardShell
      xKey="x-encryption"
      title="Encryption"
      purpose="Protect this value at rest: hash it on write or encrypt it per instance. Applied after x-roles and x-masking on every read."
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
      {legacy && (
        <p className="rounded-md border border-warning-border bg-warning-surface px-2 py-1 text-[10px] text-warning-text">
          Type <code>{rawType}</code> was never enforced and is rejected at publish since runtime 0.0.99. Pick none,
          hash or encrypt.
        </p>
      )}
      <Field label="Type">
        <Select
          className="h-8 text-xs"
          value={type ?? ''}
          onChange={(event) => write(withEncryptionType(value, event.target.value as EncryptionType))}>
          {type === null && <option value="">{rawType} (removed)</option>}
          {ENCRYPTION_TYPES.map((option) => (
            <option key={option} value={option}>
              {TYPE_LABELS[option]}
            </option>
          ))}
        </Select>
      </Field>

      {type === 'hash' && (
        <Field label="Algorithm">
          <Select
            className="h-8 text-xs"
            value={typeof params.algorithm === 'string' ? params.algorithm : 'sha256'}
            onChange={(event) =>
              patch('params', event.target.value === 'sha256' ? undefined : { algorithm: event.target.value })
            }>
            <option value="sha256">sha256 (default)</option>
            <option value="sha512">sha512</option>
          </Select>
        </Field>
      )}

      {type === 'encrypt' && (
        <Field label="Callers who receive plaintext">
          <RoleGrantListEditor
            allowOnly
            roles={normalizeRoleEntries(value.roles, { allowOnly: true })}
            onChange={(next) => patch('roles', next.length > 0 ? next : undefined)}
          />
        </Field>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Purpose" hint="Governance metadata; not enforced.">
          <Input
            type="text"
            value={typeof value.purpose === 'string' ? value.purpose : ''}
            onChange={(event) => patch('purpose', event.target.value || undefined)}
            inputClassName="text-xs"
          />
        </Field>
        <Field label="Retention (days)" hint="Governance metadata; not enforced.">
          <Input
            type="number"
            min={1}
            value={typeof value.retentionDays === 'number' ? value.retentionDays : ''}
            onChange={(event) => {
              const n = Number(event.target.value);
              patch('retentionDays', event.target.value !== '' && Number.isInteger(n) && n >= 1 ? n : undefined);
            }}
            inputClassName="text-xs"
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[11px]">
        <Checkbox
          checked={value.redactInLogs === true}
          onCheckedChange={(checked) => patch('redactInLogs', checked === true ? true : undefined)}
        />
        Redact in logs (metadata)
      </label>
    </VNextCardShell>
  );
}
