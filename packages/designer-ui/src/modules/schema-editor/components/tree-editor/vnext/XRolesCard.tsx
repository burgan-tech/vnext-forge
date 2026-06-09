import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import {
  RoleGrantListEditor,
  normalizeRoleEntries,
  type RoleGrantEntry,
} from './RoleGrantListEditor';
import { VNextCardShell } from './VNextCardShell';

// Vocab `minItems: 1` — seed with one empty row so the user has a
// starting point and validation is satisfied as soon as a role name
// is typed.
const DEFAULT_VALUE = (): RoleGrantEntry[] => [{ role: '', grant: 'allow' }];

interface XRolesCardProps {
  pointer: JsonPointer;
}

/**
 * `x-roles` carries role-based visibility / permission grants for a
 * view root or an individual field. Roles can be static names (e.g.
 * `morph-idm.initiator`) or dynamic expressions resolved against the
 * runtime context (e.g.
 * `$userBehalfOf.$.context.Instance.Data.initial.customer.ownerUserId`).
 * Grants are `allow` or `deny`, with DENY overriding ALLOW.
 *
 * Persisted shape (matches `vocabularies/view-vocab.json` x-roles):
 *
 *   [{ role: string, grant: 'allow' | 'deny' }, …]
 */
export function XRolesCard({ pointer }: XRolesCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-roles', DEFAULT_VALUE);
  const value = normalizeRoleEntries(node?.['x-roles']);

  return (
    <VNextCardShell
      xKey="x-roles"
      title="Roles"
      purpose="Role-scoped allow/deny grants. DENY overrides ALLOW. Roles can be static names or dynamic expressions."
      enabled={enabled}
      onToggle={toggle}>
      <RoleGrantListEditor
        roles={value}
        onChange={(next) => {
          updateComponent(setKeyword(pointer, 'x-roles', next));
        }}
      />
    </VNextCardShell>
  );
}
