import { useCallback } from 'react';
import { Shield } from 'lucide-react';
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { RoleGrantEditor } from '../tabs/subflow/RoleGrantEditor';
import { MetadataSection } from './MetadataSection';

export function WorkflowQueryRolesSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const queryRoles: RoleGrant[] = attrs.queryRoles ?? [];

  const handleChange = useCallback(
    (roles: RoleGrant[]) => {
      updateWorkflow((draft: any) => {
        if (!draft.attributes) draft.attributes = {};
        draft.attributes.queryRoles = roles.length > 0 ? roles : undefined;
      });
    },
    [updateWorkflow],
  );

  return (
    <MetadataSection
      title={`Query Roles${queryRoles.length > 0 ? ` (${queryRoles.length})` : ''}`}
      icon={<Shield size={13} />}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Control which roles can query this workflow.
      </p>
      <RoleGrantEditor roles={queryRoles} onChange={handleChange} contextLabel="workflow" />
    </MetadataSection>
  );
}
