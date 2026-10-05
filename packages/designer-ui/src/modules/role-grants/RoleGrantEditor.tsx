import { roleGrantMode, type RoleGrant, type RoleGrantMode } from '@vnext-forge-studio/vnext-types';

import { useFormReadOnly } from '../../ui/FormReadOnlyContext';
import { EditableInput, SelectField, IconPlus, IconTrash } from '../canvas-interaction/components/panels/tabs/PropertyPanelShared';
import { SchemaFeatureHint } from './SchemaFeatureHint';
import { useSchemaFeature } from './useSchemaFeature';

const GRANT_OPTIONS = [
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
] as const;

const MODE_OPTIONS = [
  { value: 'role', label: 'Role' },
  { value: 'allOf', label: 'All of' },
  { value: 'anyOf', label: 'Any of' },
] as const;

interface RoleGrantEditorProps {
  roles: RoleGrant[];
  onChange: (roles: RoleGrant[]) => void;
  contextLabel?: string;
  /**
   * Component whose pinned schema decides whether `allOf` / `anyOf` grants
   * may be authored (vnext-schema 0.0.55+). Schema `x-roles` uses the
   * workflow schema of the same release as its stand-in.
   */
  componentType?: 'workflow' | 'function';
  /** Placeholder of the single-role input. */
  rolePlaceholder?: string;
}

/** Rebuilds `grant` in `mode`, carrying the roles it already names over. */
export function switchRoleGrantMode(grant: RoleGrant, mode: RoleGrantMode): RoleGrant {
  const current = roleGrantMode(grant);
  if (current === mode) return grant;
  const names =
    current === 'role' ? (grant.role ? [grant.role] : []) : (grant[current] ?? []).map((c) => c.role);
  if (mode === 'role') return { role: names[0] ?? '', grant: grant.grant };
  return { [mode]: (names.length > 0 ? names : ['']).map((role) => ({ role })), grant: grant.grant };
}

/**
 * The role-grant list editor used by every role surface — workflow and
 * state `queryRoles`, transition `roles`, `availableIn`, long-poll roles,
 * state aliases, subflow overrides, function `roles` and schema `x-roles`.
 * Each grant names one role, or an all-of / any-of group of roles, and
 * allows or denies. (`x-masking` / `x-encryption` exemption lists are
 * allow-only plain roles and keep their own editor.)
 *
 * The All of / Any of kinds stay visible on older project schemas but are
 * disabled there, with the reason shown; grants already in the file are
 * always shown and editable so nothing is silently rewritten.
 */
export function RoleGrantEditor({
  roles,
  onChange,
  contextLabel,
  componentType = 'workflow',
  rolePlaceholder = 'e.g. morph-idm.maker',
}: RoleGrantEditorProps) {
  const readOnly = useFormReadOnly();
  const { supported: combinatorsSupported, schemaVersion } = useSchemaFeature(
    componentType,
    'definitions.roleGrant.allOf',
  );

  const addRole = () => {
    onChange([...roles, { role: '', grant: 'allow' }]);
  };

  const replace = (index: number, next: RoleGrant) => {
    onChange(roles.map((r, i) => (i === index ? next : r)));
  };

  const removeRole = (index: number) => {
    onChange(roles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      {roles.map((r, i) => {
        const mode = roleGrantMode(r);
        const removeLabel = r.role || (mode === 'role' ? 'entry' : mode);
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-24 shrink-0">
                <SelectField
                  value={mode}
                  onChange={(v) => {
                    if (!readOnly) replace(i, switchRoleGrantMode(r, v as RoleGrantMode));
                  }}
                  options={MODE_OPTIONS.map((o) => ({
                    ...o,
                    disabled: readOnly || (o.value !== 'role' && o.value !== mode && !combinatorsSupported),
                  }))}
                />
              </div>
              <div className="min-w-0 flex-1">
                {mode === 'role' ? (
                  <EditableInput
                    value={r.role ?? ''}
                    onChange={(v) => {
                      if (!readOnly) replace(i, { ...r, role: v });
                    }}
                    mono
                    placeholder={rolePlaceholder}
                  />
                ) : (
                  <span className="text-muted-foreground text-[11px]">
                    {mode === 'allOf' ? 'Caller must hold every role' : 'Caller must hold at least one role'}
                  </span>
                )}
              </div>
              <div className="w-20 shrink-0">
                <SelectField
                  value={r.grant}
                  onChange={(v) => {
                    if (!readOnly) replace(i, { ...r, grant: v as RoleGrant['grant'] });
                  }}
                  options={GRANT_OPTIONS.map((o) => ({ ...o, disabled: readOnly && o.value !== r.grant }))}
                />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeRole(i)}
                  className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 transition-all"
                  title={contextLabel ? `Remove role from ${contextLabel}` : 'Remove role'}
                  aria-label={contextLabel ? `Remove role ${removeLabel} from ${contextLabel}` : `Remove role ${removeLabel}`}>
                  <IconTrash />
                </button>
              )}
            </div>
            {mode !== 'role' && (
              <ConditionList
                roles={(r[mode] ?? []).map((c) => c.role)}
                readOnly={readOnly}
                onChange={(names) => replace(i, { ...r, [mode]: names.map((role) => ({ role })) })}
              />
            )}
          </div>
        );
      })}
      {!readOnly && (
        <button
          type="button"
          onClick={addRole}
          className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Add role
        </button>
      )}
      {!combinatorsSupported && !readOnly && (
        <SchemaFeatureHint feature="All of / Any of role groups" schemaVersion={schemaVersion} />
      )}
    </div>
  );
}

function ConditionList({
  roles,
  readOnly,
  onChange,
}: {
  roles: string[];
  readOnly: boolean;
  onChange: (roles: string[]) => void;
}) {
  return (
    <div className="border-border ml-3 space-y-1 border-l pl-2">
      {roles.map((role, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <EditableInput
              value={role}
              onChange={(v) => {
                if (!readOnly) onChange(roles.map((x, j) => (j === i ? v : x)));
              }}
              mono
              placeholder="role"
            />
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange(roles.filter((_, j) => j !== i))}
              disabled={roles.length <= 1}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-40"
              title={roles.length <= 1 ? 'A group needs at least one role' : 'Remove condition'}
              aria-label={`Remove condition ${role || 'entry'}`}>
              <IconTrash />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...roles, ''])}
          className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Add condition
        </button>
      )}
    </div>
  );
}
