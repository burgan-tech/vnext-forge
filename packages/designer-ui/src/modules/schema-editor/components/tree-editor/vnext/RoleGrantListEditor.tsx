import { Plus, Trash2 } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';

export interface RoleGrantEntry {
  role: string;
  grant: 'allow' | 'deny';
}

interface RoleGrantListEditorProps {
  roles: RoleGrantEntry[];
  onChange: (next: RoleGrantEntry[]) => void;
}

/**
 * Lightweight list editor for the `x-roles` array. Each entry binds a
 * role identifier (a static name like `morph-idm.initiator` or a
 * dynamic expression such as `$userBehalfOf.$.context.Instance.Data...`)
 * to a grant verb (`allow` / `deny`).
 *
 * The vocabulary contract: at least one entry, DENY overrides ALLOW.
 * The card-level toggle seeds the first entry on enable, so the empty
 * state below should normally only appear if the user manually
 * removes every row.
 */
export function RoleGrantListEditor({ roles, onChange }: RoleGrantListEditorProps) {
  function updateEntry(index: number, patch: Partial<RoleGrantEntry>) {
    onChange(roles.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
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
          No roles yet. DENY overrides ALLOW when both match.
        </p>
      ) : (
        roles.map((entry, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2 sm:grid-cols-[2fr_auto_auto]">
            <Field label="Role">
              <Input
                type="text"
                value={entry.role}
                onChange={(event) => updateEntry(index, { role: event.target.value })}
                placeholder="morph-idm.initiator or $userBehalfOf.$.…"
                inputClassName="font-mono text-xs"
              />
            </Field>
            <Field label="Grant">
              <Select
                className="h-8 text-xs"
                value={entry.grant}
                onChange={(event) =>
                  updateEntry(index, {
                    grant: event.target.value === 'deny' ? 'deny' : 'allow',
                  })
                }>
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
              </Select>
            </Field>
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
          </div>
        ))
      )}

      <Button
        type="button"
        variant="success"
        size="sm"
        className="h-7 gap-1 text-[10px]"
        onClick={addEntry}>
        <Plus size={10} />
        Add role
      </Button>
    </div>
  );
}

export function normalizeRoleEntries(value: unknown): RoleGrantEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): RoleGrantEntry[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const role = typeof record.role === 'string' ? record.role : '';
    const rawGrant = typeof record.grant === 'string' ? record.grant : 'allow';
    const grant: 'allow' | 'deny' = rawGrant === 'deny' ? 'deny' : 'allow';
    return [{ role, grant }];
  });
}
