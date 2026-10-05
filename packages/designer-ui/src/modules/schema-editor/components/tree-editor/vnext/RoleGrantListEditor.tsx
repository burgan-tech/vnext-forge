import { Plus, Trash2 } from 'lucide-react';
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';

import { Button } from '../../../../../ui/Button';
import { Field } from '../../../../../ui/Field';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { Input } from '../../../../../ui/Input';

/** A stored role grant (`role` XOR `allOf` XOR `anyOf`, plus `grant`). */
export type RoleGrantEntry = RoleGrant;

interface ExemptRoleListEditorProps {
  roles: RoleGrantEntry[];
  onChange: (next: RoleGrantEntry[]) => void;
}

/**
 * Exemption list of `x-masking` / `x-encryption` (vnext-schema 0.0.55): plain
 * `{ role, grant: 'allow' }` entries only — no deny, no all-of / any-of. A
 * caller holding a listed role sees the raw value. Every other role surface,
 * `x-roles` included, uses the shared `RoleGrantEditor`.
 */
export function ExemptRoleListEditor({ roles, onChange }: ExemptRoleListEditorProps) {
  const readOnly = useFormReadOnly();

  return (
    <div className="space-y-2">
      {roles.length === 0 ? (
        <p className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2 text-[10px] text-primary-text/55">
          No exempt roles: every caller sees the protected value.
        </p>
      ) : (
        roles.map((entry, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2 sm:grid-cols-[1fr_auto]">
            <Field label="Role (allow)">
              <Input
                type="text"
                value={entry.role ?? ''}
                onChange={(event) =>
                  onChange(roles.map((r, i) => (i === index ? { role: event.target.value, grant: 'allow' } : r)))
                }
                placeholder="morph-idm.auditor"
                inputClassName="font-mono text-xs"
              />
            </Field>
            {!readOnly && (
              <div className="flex items-end pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-destructive-text"
                  onClick={() => onChange(roles.filter((_, i) => i !== index))}
                  aria-label={`Remove role ${entry.role || 'entry'}`}>
                  <Trash2 size={12} />
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      {!readOnly && (
        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={() => onChange([...roles, { role: '', grant: 'allow' }])}>
          <Plus size={10} />
          Add role
        </Button>
      )}
    </div>
  );
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
