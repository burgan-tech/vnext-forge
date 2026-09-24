import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { RoleGrantEditor } from '../../canvas-interaction/components/panels/tabs/subflow/RoleGrantEditor';

interface FunctionRolesSectionProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function applyFunctionRoles(draft: Record<string, unknown>, next: RoleGrant[]): void {
  const attributes = (draft.attributes ?? {}) as Record<string, unknown>;
  if (next.length > 0) attributes.roles = next;
  else delete attributes.roles;
  draft.attributes = attributes;
}

/**
 * `attributes.roles` of a custom function. The runtime evaluates them only in
 * the authorize function (`?functionKey=`); invoking the function does not
 * check them.
 */
export function FunctionRolesSection({ json, onChange }: FunctionRolesSectionProps) {
  const attributes = (json.attributes ?? {}) as Record<string, unknown>;
  const roles = Array.isArray(attributes.roles) ? (attributes.roles as RoleGrant[]) : [];

  return (
    <Card variant="default" className="gap-3">
      <CardHeader className="border-border border-b">
        <CardTitle className="text-base">Roles</CardTitle>
        <CardDescription className="text-xs">
          Authorize-only grants: the authorize function (?functionKey=) evaluates them so a client
          can decide whether to offer this function. They are not an invocation gate — calling the
          function does not check them. No roles means every caller is allowed.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <RoleGrantEditor
          roles={roles}
          onChange={(next) => onChange((draft) => applyFunctionRoles(draft, next))}
          contextLabel="function"
        />
      </CardContent>
    </Card>
  );
}
