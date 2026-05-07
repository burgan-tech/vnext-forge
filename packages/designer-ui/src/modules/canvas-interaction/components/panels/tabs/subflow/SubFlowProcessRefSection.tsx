import { useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { EditableInput } from '../PropertyPanelShared';
import {
  ChooseExistingVnextComponentDialog,
  ChooseFromExistingVnextComponentButton,
} from '../ChooseExistingTaskDialog';
import { Trash2 } from 'lucide-react';

interface ProcessRef {
  key: string;
  domain: string;
  version: string;
  flow: string;
}

interface SubFlowProcessRefSectionProps {
  process: ProcessRef;
  projectDomain: string;
  onUpdateField: (field: keyof ProcessRef, value: string) => void;
  onSelectWorkflow: (component: DiscoveredVnextComponent) => void;
  onRemove: () => void;
  canPickExisting: boolean;
}

export function SubFlowProcessRefSection({
  process,
  projectDomain,
  onUpdateField,
  onSelectWorkflow,
  onRemove,
  canPickExisting,
}: SubFlowProcessRefSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <div className="border border-border rounded-lg p-3 bg-surface">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        SubFlow reference
      </div>

      <div className="space-y-1.5">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Key</label>
          <EditableInput value={process.key || ''} onChange={(v) => onUpdateField('key', v)} mono placeholder="e.g. order-fulfillment" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Domain</label>
          <EditableInput value={process.domain || ''} onChange={(v) => onUpdateField('domain', v)} mono placeholder={projectDomain || 'e.g. core'} />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Version</label>
          <EditableInput value={process.version || ''} onChange={(v) => onUpdateField('version', v)} mono placeholder="e.g. 1.0.0" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Flow</label>
          <EditableInput value={process.flow || ''} onChange={(v) => onUpdateField('flow', v)} mono placeholder="e.g. sys-flows" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <ChooseFromExistingVnextComponentButton
          category="workflows"
          onClick={() => setPickerOpen(true)}
          disabled={!canPickExisting}
          title={
            canPickExisting
              ? 'Pick a workflow from workspace JSON files'
              : 'Requires an open project and vnext.config.json with paths'
          }
        />

        {!confirmingRemove ? (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors"
            title="Remove SubFlow configuration">
            <Trash2 size={13} aria-hidden />
            Remove SubFlow
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-destructive-text">Remove?</span>
            <button
              type="button"
              onClick={() => {
                setConfirmingRemove(false);
                onRemove();
              }}
              className="text-[10px] font-semibold text-destructive-text hover:bg-destructive-surface rounded px-1.5 py-0.5 cursor-pointer transition-colors">
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="text-[10px] font-semibold text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 cursor-pointer transition-colors">
              Cancel
            </button>
          </div>
        )}
      </div>

      <ChooseExistingVnextComponentDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        category="workflows"
        onSelect={onSelectWorkflow}
        title="Choose a workflow"
        description="Select a workflow JSON from your workspace paths to use as a SubFlow reference."
      />
    </div>
  );
}
