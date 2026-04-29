import { useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import { Field } from '../../../../ui/Field';
import { Input } from '../../../../ui/Input';
import { useProjectStore } from '../../../../store/useProjectStore';
import {
  ChooseExistingVnextComponentDialog,
  ChooseFromExistingVnextComponentButton,
} from '../../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';

interface WorkflowRefFieldsProps {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
  /** Called after a workflow is picked from the dialog so the parent form can react (e.g. load transitions). */
  onWorkflowSelected?: (component: DiscoveredVnextComponent) => void;
}

/**
 * Domain + Flow input grid with a "Choose existing workflow" lookup button.
 * On selection the callback sets triggerDomain, triggerFlow, and triggerVersion;
 * free-text entry always remains available.
 */
export function WorkflowRefFields({ config, onChange, onWorkflowSelected }: WorkflowRefFieldsProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const [pickerOpen, setPickerOpen] = useState(false);

  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  function handleSelect(component: DiscoveredVnextComponent) {
    onChange((d: any) => {
      d.triggerDomain = projectDomain;
      d.triggerFlow = component.key || '';
      d.triggerVersion = component.version || undefined;
    });
    onWorkflowSelected?.(component);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary-text/75">Target Workflow</span>
        <ChooseFromExistingVnextComponentButton
          category="workflows"
          onClick={() => setPickerOpen(true)}
          disabled={!canPickExisting}
          label="Choose existing workflow"
          title={
            canPickExisting
              ? 'Pick a workflow from workspace JSON files'
              : 'Requires an open project and vnext.config.json with paths'
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Domain" required>
          <Input type="text" value={String(config.triggerDomain || '')}
            onChange={(e) => onChange((d: any) => { d.triggerDomain = e.target.value; })}
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Flow" required>
          <Input type="text" value={String(config.triggerFlow || '')}
            onChange={(e) => onChange((d: any) => { d.triggerFlow = e.target.value; })}
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
      </div>
      <ChooseExistingVnextComponentDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        category="workflows"
        onSelect={handleSelect}
        title="Choose a workflow"
        description="Select a workflow JSON from your workspace paths. Domain uses the current vnext config."
      />
    </>
  );
}
