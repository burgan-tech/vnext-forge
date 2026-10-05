import { Plus, Trash2 } from 'lucide-react';
import { roleGrantMode, type RoleGrant, type RoleGrantMode } from '@vnext-forge-studio/vnext-types';

import { Button } from '../../../../../ui/Button';
import { Field } from '../../../../../ui/Field';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';

/**
 * One `x-roles` / exemption-list entry. `role` XOR `allOf` XOR `anyOf`
 * (vnext-schema 0.0.55 role-grant combinators); the plain `role` form is the
 * only one older schemas accept.
 */
export type RoleGrantEntry = RoleGrant;

interface RoleGrantListEditorProps {
  roles: RoleGrantEntry[];
  onChange: (next: RoleGrantEntry[]) => void;
  /**
   * Exemption lists of `x-masking` / `x-encryption`: plain `role` entries with
   * `grant: 'allow'` only — no deny, no combinators.
   */
  allowOnly?: boolean;
}

/**
 * List editor for `x-roles` and the field-protection exemption lists. Each
 * entry binds a role identifier (a static name like `morph-idm.initiator` or
 * a dynamic expression such as `$userBehalfOf.$.context.Instance.Data...`),
 * or an `allOf` / `anyOf` group of roles, to a grant verb.
 *
 * The vocabulary contract for `x-roles`: at least one entry, DENY overrides
 * ALLOW. The card-level toggle seeds the first entry on enable.
 */
export function RoleGrantListEditor({ roles, onChange, allowOnly = false }: RoleGrantListEditorProps) {
  const readOnly = useFormReadOnly();

  function replaceEntry(index: number, next: RoleGrantEntry) {
    onChange(roles.map((entry, i) => (i === index ? next : entry)));
  }

  function removeEntry(index: number) {
    onChange(roles.filter((_, i) => i !== index));
  }

  function addEntry() {
    onChange([...roles, { role: '', grant: 'allow' }]);
  }

  return (
    <div className="space-y-2">
      {roles.length === 0 ? (
        <p className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2 text-[10px] text-primary-text/55">
          {allowOnly ? 'No exempt roles: every caller sees the protected value.' : 'No roles yet. DENY overrides ALLOW when both match.'}
        </p>
      ) : (
        roles.map((entry, index) => {
          const mode = roleGrantMode(entry);
          return (
            <div
              key={index}
              className={`grid gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2 ${
                allowOnly ? 'sm:grid-cols-[1fr_auto]' : 'sm:grid-cols-[auto_2fr_auto_auto]'
              }`}>
              {!allowOnly && (
                <Field label="Kind">
                  <Select
                    className="h-8 text-xs"
                    value={mode}
                    aria-label="Grant kind"
                    onChange={(event) => replaceEntry(index, switchMode(entry, event.target.value as RoleGrantMode))}>
                    <option value="role">Role</option>
                    <option value="allOf">All of</option>
                    <option value="anyOf">Any of</option>
                  </Select>
                </Field>
              )}
              {mode === 'role' ? (
                <Field label="Role">
                  <Input
                    type="text"
                    value={entry.role ?? ''}
                    onChange={(event) => replaceEntry(index, { ...entry, role: event.target.value })}
                    placeholder="morph-idm.initiator or $userBehalfOf.$.…"
                    inputClassName="font-mono text-xs"
                  />
                </Field>
              ) : (
                <Field label={mode === 'allOf' ? 'Roles (all required)' : 'Roles (any one)'}>
                  <Input
                    type="text"
                    value={(entry[mode] ?? []).map((c) => c.role).join(', ')}
                    onChange={(event) =>
                      replaceEntry(index, {
                        ...entry,
                        [mode]: splitRoles(event.target.value).map((role) => ({ role })),
                      })
                    }
                    placeholder="role-a, role-b"
                    inputClassName="font-mono text-xs"
                    aria-label={mode === 'allOf' ? 'All-of roles, comma separated' : 'Any-of roles, comma separated'}
                  />
                </Field>
              )}
              {!allowOnly && (
                <Field label="Grant">
                  <Select
                    className="h-8 text-xs"
                    value={entry.grant}
                    onChange={(event) =>
                      replaceEntry(index, { ...entry, grant: event.target.value === 'deny' ? 'deny' : 'allow' })
                    }>
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </Select>
                </Field>
              )}
              {!readOnly && (
                <div className="flex items-end pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 text-destructive-text"
                    onClick={() => removeEntry(index)}
                    aria-label={`Remove role ${entry.role || 'entry'}`}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}

      {!readOnly && (
        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={addEntry}>
          <Plus size={10} />
          Add role
        </Button>
      )}
    </div>
  );
}

/**
 * Comma-separated input → role names. Empty slots are kept so a trailing
 * comma survives while the user is still typing the next role.
 */
function splitRoles(value: string): string[] {
  return value.split(',').map((part) => part.trim());
}

function switchMode(entry: RoleGrantEntry, mode: RoleGrantMode): RoleGrantEntry {
  const current = roleGrantMode(entry);
  if (current === mode) return entry;
  const names = current === 'role' ? (entry.role ? [entry.role] : []) : (entry[current] ?? []).map((c) => c.role);
  if (mode === 'role') return { role: names[0] ?? '', grant: entry.grant };
  return { [mode]: (names.length > 0 ? names : ['']).map((role) => ({ role })), grant: entry.grant };
}

/**
 * Reads a stored grant list without losing data: `allOf` / `anyOf` entries
 * are kept as-is (they used to be flattened to `{ role: '' }`). With
 * `allowOnly`, every entry is coerced to the exemption-list shape.
 */
export function normalizeRoleEntries(value: unknown, options: { allowOnly?: boolean } = {}): RoleGrantEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): RoleGrantEntry[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const grant: 'allow' | 'deny' = record.grant === 'deny' ? 'deny' : 'allow';
    const conditions = (list: unknown) =>
      Array.isArray(list)
        ? list.flatMap((c) =>
            c && typeof c === 'object' && typeof (c as { role?: unknown }).role === 'string'
              ? [{ role: (c as { role: string }).role }]
              : [],
          )
        : [];
    if (!options.allowOnly) {
      if (Array.isArray(record.allOf)) return [{ allOf: conditions(record.allOf), grant }];
      if (Array.isArray(record.anyOf)) return [{ anyOf: conditions(record.anyOf), grant }];
    }
    const role = typeof record.role === 'string' ? record.role : '';
    return [{ role, grant: options.allowOnly ? 'allow' : grant }];
  });
}
