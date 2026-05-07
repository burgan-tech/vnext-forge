import { useState, useCallback } from 'react';
import { Puzzle, Trash2, Plus } from 'lucide-react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../store/useProjectStore';
import { ChooseExistingVnextComponentDialog } from '../tabs/ChooseExistingTaskDialog';
import { CreateNewComponentDialog } from '../tabs/CreateNewComponentDialog';
import { OpenVnextComponentInModalButton } from '../../../../save-component/components/OpenVnextComponentInModalButton';
import { MetadataSection } from './MetadataSection';

export function WorkflowExtensionsSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const extensions: any[] = attrs.extensions || [];
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';

  const addExtension = useCallback(
    (component: DiscoveredVnextComponent) => {
      updateWorkflow((draft: any) => {
        if (!draft.attributes.extensions) draft.attributes.extensions = [];
        const existing = draft.attributes.extensions as any[];
        if (existing.some((e: any) => e.key === component.key && e.flow === (component.flow || 'sys-extensions'))) {
          return;
        }
        existing.push({
          key: component.key,
          domain: projectDomain,
          version: component.version || '1.0.0',
          flow: component.flow || 'sys-extensions',
        });
      });
    },
    [updateWorkflow, projectDomain],
  );

  const removeExtension = (index: number) => {
    updateWorkflow((draft: any) => {
      draft.attributes?.extensions?.splice(index, 1);
    });
  };

  const canPick = Boolean(activeProject && vnextConfig?.paths);

  return (
    <MetadataSection
      title={`Extensions (${extensions.length})`}
      icon={<Puzzle size={13} />}>
      <div className="space-y-1.5">
        {extensions.length === 0 && (
          <p className="text-[11px] text-muted-foreground leading-relaxed py-1">
            No extensions selected. Choose an existing one or create a new extension.
          </p>
        )}
        {extensions.map((item, i) => (
          <div
            key={`${item.key}-${i}`}
            className="bg-surface border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {item.key || '—'}
            </span>
            {item.domain && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                @{item.domain}
              </span>
            )}
            {item.key && item.flow && (
              <OpenVnextComponentInModalButton
                componentKey={item.key}
                flow={item.flow}
                iconOnly
                title={`Open extension ${item.key} in modal editor`}
              />
            )}
            <button
              onClick={() => removeExtension(i)}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1 transition-all"
              aria-label={`Remove extension ${item.key}`}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <button
            onClick={() => setPickerOpen(true)}
            disabled={!canPick}
            className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45">
            <Plus size={13} /> Choose Extension…
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            disabled={!canPick}
            className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            title="Create a new extension JSON under Extensions/">
            <Plus size={13} /> Create New
          </button>
        </div>
      </div>
      <ChooseExistingVnextComponentDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        category="extensions"
        onSelect={addExtension}
      />
      <CreateNewComponentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        category="extensions"
        onCreated={addExtension}
      />
    </MetadataSection>
  );
}
