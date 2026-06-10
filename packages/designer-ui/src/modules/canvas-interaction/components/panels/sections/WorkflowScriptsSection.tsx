import { useCallback } from 'react';
import { Code2 } from 'lucide-react';

import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { MappingScriptsSection } from '../../../../save-component/components/MappingScriptsSection';
import { MetadataSection } from './MetadataSection';

/**
 * Workflow-level `attributes.scripts` — surfaces the same
 * `{helpers, allowedAssemblies}` shape that every mapping object
 * carries, scoped to the whole workflow runtime instead of an
 * individual mapping slot. Persisted as `attributes.scripts` (or
 * absent when both lists are empty).
 */
export function WorkflowScriptsSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as { attributes?: Record<string, unknown> }).attributes ?? {};
  const scripts = (attrs as { scripts?: ScriptsConfig }).scripts;

  const handleChange = useCallback(
    (next: ScriptsConfig | undefined) => {
      updateWorkflow((draft: { attributes?: Record<string, unknown> }) => {
        if (!draft.attributes) draft.attributes = {};
        if (next === undefined) {
          delete (draft.attributes as Record<string, unknown>).scripts;
        } else {
          (draft.attributes as Record<string, unknown>).scripts = next;
        }
      });
    },
    [updateWorkflow],
  );

  const helpersCount = scripts?.helpers?.length ?? 0;
  const assembliesCount = scripts?.allowedAssemblies?.length ?? 0;
  const totalCount = helpersCount + assembliesCount;

  return (
    <MetadataSection
      title={`Scripts${totalCount > 0 ? ` (${totalCount})` : ''}`}
      icon={<Code2 size={13} />}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Workflow-wide CSX helpers (from <code>sys-mappings</code>) and .NET assemblies the
        runtime is allowed to import.
      </p>
      <MappingScriptsSection
        value={scripts}
        onChange={handleChange}
        label="Workflow helpers & assemblies"
      />
    </MetadataSection>
  );
}
