import { useState, useCallback } from 'react';
import { Database, Plus, Trash2 } from 'lucide-react';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../store/useProjectStore';
import { ChooseExistingVnextComponentDialog } from '../tabs/ChooseExistingTaskDialog';
import { CreateNewComponentDialog } from '../tabs/CreateNewComponentDialog';
import { OpenVnextComponentInModalButton } from '../../../../save-component/components/OpenVnextComponentInModalButton';
import { MetadataSection } from './MetadataSection';

export function WorkflowSchemaSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const schema: { key: string; domain: string; version: string; flow: string } | undefined =
    attrs.schema;
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPick = Boolean(activeProject && vnextConfig?.paths);

  const setSchema = useCallback(
    (component: DiscoveredVnextComponent) => {
      updateWorkflow((draft: any) => {
        if (!draft.attributes) draft.attributes = {};
        draft.attributes.schema = {
          key: component.key,
          domain: projectDomain,
          version: component.version || '1.0.0',
          flow: component.flow || 'sys-schemas',
        };
      });
    },
    [updateWorkflow, projectDomain],
  );

  const removeSchema = () => {
    updateWorkflow((draft: any) => {
      delete draft.attributes.schema;
    });
  };

  return (
    <MetadataSection title="Master Schema" icon={<Database size={13} />}>
      <div className="space-y-1.5">
        {!schema && (
          <p className="text-[11px] text-muted-foreground leading-relaxed py-1">
            No master schema configured. Choose an existing one or create a new schema.
          </p>
        )}

        {schema && (
          <div className="bg-surface border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {schema.key || '—'}
            </span>
            {schema.domain && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                @{schema.domain}
              </span>
            )}
            {schema.key && schema.flow && (
              <OpenVnextComponentInModalButton
                componentKey={schema.key}
                flow={schema.flow}
                iconOnly
                title={`Open schema ${schema.key} in modal editor`}
              />
            )}
            <button
              onClick={removeSchema}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1 transition-all"
              aria-label={`Remove schema ${schema.key}`}>
              <Trash2 size={13} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <button
            onClick={() => setPickerOpen(true)}
            disabled={!canPick}
            className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45">
            <Plus size={13} /> Choose Schema…
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            disabled={!canPick}
            className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            title="Create a new schema JSON under Schemas/">
            <Plus size={13} /> Create New
          </button>
        </div>
      </div>

      <ChooseExistingVnextComponentDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        category="schemas"
        onSelect={setSchema}
      />
      <CreateNewComponentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        category="schemas"
        onCreated={setSchema}
      />
    </MetadataSection>
  );
}
