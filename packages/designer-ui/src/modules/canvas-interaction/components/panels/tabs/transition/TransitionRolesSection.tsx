import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { RoleGrantEditor } from '../subflow/RoleGrantEditor';
import { Section } from '../PropertyPanelShared';

interface TransitionRolesSectionProps {
  roles: RoleGrant[];
  onChange: (roles: RoleGrant[]) => void;
}

export function TransitionRolesSection({ roles, onChange }: TransitionRolesSectionProps) {
  return (
    <Section title="Roles" count={roles.length} defaultOpen={roles.length > 0}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Control which roles are allowed or denied for this transition.
      </p>
      <RoleGrantEditor
        roles={roles}
        onChange={onChange}
        contextLabel="transition"
      />
    </Section>
  );
}
