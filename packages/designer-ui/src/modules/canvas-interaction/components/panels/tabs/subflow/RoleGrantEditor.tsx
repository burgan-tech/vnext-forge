import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { EditableInput, SelectField, IconPlus, IconTrash } from '../PropertyPanelShared';

const GRANT_OPTIONS = [
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
] as const;

interface RoleGrantEditorProps {
  roles: RoleGrant[];
  onChange: (roles: RoleGrant[]) => void;
  contextLabel?: string;
}

export function RoleGrantEditor({ roles, onChange, contextLabel }: RoleGrantEditorProps) {
  const addRole = () => {
    onChange([...roles, { role: '', grant: 'allow' }]);
  };

  const updateRole = (index: number, field: keyof RoleGrant, value: string) => {
    const next = roles.map((r, i) =>
      i === index ? { ...r, [field]: value } : r,
    );
    onChange(next);
  };

  const removeRole = (index: number) => {
    onChange(roles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      {roles.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <EditableInput
              value={r.role}
              onChange={(v) => updateRole(i, 'role', v)}
              mono
              placeholder="e.g. morph-idm.maker"
            />
          </div>
          <div className="w-20 shrink-0">
            <SelectField
              value={r.grant}
              onChange={(v) => updateRole(i, 'grant', v)}
              options={[...GRANT_OPTIONS]}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRole(i)}
            className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 transition-all"
            title={contextLabel ? `Remove role from ${contextLabel}` : 'Remove role'}
            aria-label={contextLabel ? `Remove role ${r.role || 'entry'} from ${contextLabel}` : `Remove role ${r.role || 'entry'}`}>
            <IconTrash />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRole}
        className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
        <IconPlus />
        Add role
      </button>
    </div>
  );
}
