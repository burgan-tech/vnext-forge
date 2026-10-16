import { Checkbox } from '../../../../../ui/Checkbox';
import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { fieldProtectionIssues, isClientEncryption } from '../../../model/fieldProtection';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useSchemaRole } from '../../../hooks/useSchemaRole';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { ExemptRoleListEditor, normalizeRoleEntries } from './RoleGrantListEditor';
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

type EncryptionValue = Record<string, unknown>;

const RUNTIME_DEFAULT = (): EncryptionValue => ({ type: 'encrypt' });
const CLIENT_DEFAULT = (): EncryptionValue => ({
  source: 'client',
  key: '',
  algorithm: 'HPKE-P256-SHA256-AES128GCM',
});

const CLIENT_ALGORITHMS = ['HPKE-P256-SHA256-AES128GCM', 'RSA-OAEP-256'] as const;
/** Members of each source; the vocabulary refuses the other source's members. */
const RUNTIME_MEMBERS = ['type', 'params', 'roles', 'redactInLogs', 'retentionDays'] as const;
const CLIENT_MEMBERS = ['key', 'algorithm', 'into', 'encoding', 'nonce', 'envelope'] as const;

/**
 * Rebuilds `x-encryption` for the other source, keeping only `purpose` (valid
 * for both). `runtime` is the default, so it is written without `source`.
 */
export function withEncryptionSource(current: EncryptionValue, source: 'runtime' | 'client'): EncryptionValue {
  const purpose = typeof current.purpose === 'string' ? { purpose: current.purpose } : {};
  return source === 'client' ? { ...CLIENT_DEFAULT(), ...purpose } : { ...RUNTIME_DEFAULT(), ...purpose };
}

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
 * `x-encryption` has two sources (vnext-schema 0.0.56):
 *  - `runtime` (default): at rest, below;
 *  - `client`: the client seals the value to a public key before the request
 *    leaves (`key`, `algorithm`, optional `into`, `encoding`, `nonce`,
 *    `envelope`); the runtime does nothing with it. Transition and function
 *    schemas accept only this source.
 *
 * Runtime source (vnext-schema 0.0.55 / runtime 0.0.99):
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
  const role = useSchemaRole();
  const inputRole = role === 'transition' || role === 'function';
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-encryption', inputRole ? CLIENT_DEFAULT : RUNTIME_DEFAULT);

  const stored = node?.['x-encryption'];
  const value: EncryptionValue = stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as EncryptionValue) : {};
  const client = isClientEncryption(value);
  const rawType = typeof value.type === 'string' ? value.type : 'none';
  const legacy = (LEGACY_TYPES as readonly string[]).includes(rawType);
  const type = (ENCRYPTION_TYPES as readonly string[]).includes(rawType) ? (rawType as EncryptionType) : null;
  const params = (value.params && typeof value.params === 'object' ? value.params : {}) as Record<string, unknown>;
  const issues = enabled ? fieldProtectionIssues(componentJson, pointer, 'x-encryption') : [];
  const foreignMembers = (client ? RUNTIME_MEMBERS : CLIENT_MEMBERS).filter((member) => value[member] !== undefined);
  if (enabled && foreignMembers.length > 0) {
    issues.push(
      `${client ? 'Client' : 'Runtime'} encryption does not accept ${foreignMembers.join(', ')}; switch the source again to rebuild the rule.`,
    );
  }
  if (enabled && client && (typeof value.key !== 'string' || value.key.trim() === '')) {
    issues.push('Client encryption needs the recipient public key.');
  }

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
      purpose="Protect this value at rest (runtime) or seal it to a public key before the request leaves (client)."
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
      <Field
        label="Source"
        hint={inputRole ? 'Transition and function schemas accept client encryption only.' : undefined}>
        <Select
          className="h-8 text-xs"
          value={client ? 'client' : 'runtime'}
          onChange={(event) => write(withEncryptionSource(value, event.target.value as 'runtime' | 'client'))}>
          <option value="runtime" disabled={inputRole && client}>
            runtime — at rest (hash / encrypt)
          </option>
          <option value="client">client — sealed in transit</option>
        </Select>
      </Field>

      {client ? (
        <ClientEncryptionFields value={value} patch={patch} />
      ) : (
        <RuntimeEncryptionFields
          value={value}
          rawType={rawType}
          legacy={legacy}
          type={type}
          params={params}
          write={write}
          patch={patch}
        />
      )}

      <Field label="Purpose" hint="Governance metadata; not enforced.">
        <Input
          type="text"
          value={typeof value.purpose === 'string' ? value.purpose : ''}
          onChange={(event) => patch('purpose', event.target.value || undefined)}
          inputClassName="text-xs"
        />
      </Field>
    </VNextCardShell>
  );
}

interface RuntimeEncryptionFieldsProps {
  value: EncryptionValue;
  rawType: string;
  legacy: boolean;
  type: EncryptionType | null;
  params: Record<string, unknown>;
  write: (next: EncryptionValue) => void;
  patch: (field: string, fieldValue: unknown) => void;
}

function RuntimeEncryptionFields({ value, rawType, legacy, type, params, write, patch }: RuntimeEncryptionFieldsProps) {
  return (
    <>
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
          <ExemptRoleListEditor
            roles={normalizeRoleEntries(value.roles, { allowOnly: true })}
            onChange={(next) => patch('roles', next.length > 0 ? next : undefined)}
          />
        </Field>
      )}

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
      <label className="flex items-center gap-2 text-[11px]">
        <Checkbox
          checked={value.redactInLogs === true}
          onCheckedChange={(checked) => patch('redactInLogs', checked === true ? true : undefined)}
        />
        Redact in logs (metadata)
      </label>
    </>
  );
}

function ClientEncryptionFields({
  value,
  patch,
}: {
  value: EncryptionValue;
  patch: (field: string, fieldValue: unknown) => void;
}) {
  const text = (field: string) => (typeof value[field] === 'string' ? (value[field] as string) : '');
  return (
    <>
      <Field
        label="Public key"
        required
        hint="Context read address (urn:client:context:read:<boundary>:<storage>:<key>) or $instance.<path>.">
        <Input
          type="text"
          value={text('key')}
          onChange={(event) => patch('key', event.target.value)}
          inputClassName="text-xs font-mono"
        />
      </Field>
      <Field label="Algorithm" required>
        <Select className="h-8 text-xs" value={text('algorithm')} onChange={(event) => patch('algorithm', event.target.value)}>
          {CLIENT_ALGORITHMS.map((algorithm) => (
            <option key={algorithm} value={algorithm}>
              {algorithm}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Send as field" hint="Field the ciphertext is sent as; empty = in place.">
          <Input
            type="text"
            value={text('into')}
            onChange={(event) => patch('into', event.target.value || undefined)}
            inputClassName="text-xs font-mono"
          />
        </Field>
        <Field label="Encoding">
          <Select
            className="h-8 text-xs"
            value={text('encoding')}
            onChange={(event) => patch('encoding', event.target.value || undefined)}>
            <option value="">default</option>
            <option value="base64">base64</option>
            <option value="base64url">base64url</option>
          </Select>
        </Field>
        <Field label="Nonce" hint="Per-record value bound into the sealed text as a replay guard.">
          <Input
            type="text"
            value={text('nonce')}
            onChange={(event) => patch('nonce', event.target.value || undefined)}
            inputClassName="text-xs font-mono"
          />
        </Field>
        <Field label="Envelope">
          <Select
            className="h-8 text-xs"
            value={text('envelope')}
            onChange={(event) => patch('envelope', event.target.value || undefined)}>
            <option value="">ciphertext only</option>
            <option value="publicKey">publicKey — prefix the public key</option>
          </Select>
        </Field>
      </div>
    </>
  );
}
