import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { IconPlus, IconTrash } from '../PropertyPanelShared';
import { RoleGrantEditor } from './RoleGrantEditor';

interface OptionalRoleOverrideProps {
  label: string;
  /** `undefined` = not overridden (child value applies); `[]` = override with no grants. */
  roles: RoleGrant[] | undefined;
  onChange: (next: RoleGrant[] | undefined) => void;
  contextLabel: string;
  /** Shown above the editor, e.g. when the runtime will ignore the override. */
  note?: string;
}

/**
 * A role list override has three states the plain editor cannot express:
 * absent (keep the child), empty (admit everyone) and a grant list. Removing
 * the last row keeps an explicit `[]`; "Remove override" drops the field.
 */
export function OptionalRoleOverride({ label, roles, onChange, contextLabel, note }: OptionalRoleOverrideProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        {roles !== undefined && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors">
            <IconTrash />
            Remove override
          </button>
        )}
      </div>
      {note && <p className="mb-1 text-[10px] leading-relaxed text-warning-text">{note}</p>}
      {roles === undefined ? (
        <button
          type="button"
          onClick={() => onChange([{ role: '', grant: 'allow' }])}
          className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Override {label.toLowerCase()}
        </button>
      ) : (
        <RoleGrantEditor roles={roles} onChange={onChange} contextLabel={contextLabel} />
      )}
    </div>
  );
}
