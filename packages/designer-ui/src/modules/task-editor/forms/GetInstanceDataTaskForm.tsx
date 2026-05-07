import { useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { TagEditor } from '../../../ui/TagEditor';
import { useProjectStore } from '../../../store/useProjectStore';
import {
  ChooseExistingVnextComponentDialog,
  ChooseFromExistingVnextComponentButton,
} from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import { DaprToggleField, HttpSettingsFields, WorkflowRefFields } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function GetInstanceDataTaskForm({ config, onChange }: Props) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const [extensionPickerOpen, setExtensionPickerOpen] = useState(false);

  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);
  const extensions = (config.extensions as string[]) || [];

  function handleExtensionSelected(component: DiscoveredVnextComponent) {
    if (!component.key || extensions.includes(component.key)) return;
    onChange((d: any) => {
      const current = (d.extensions as string[]) || [];
      d.extensions = [...current, component.key];
    });
  }

  return (
    <div className="space-y-3">
      <WorkflowRefFields config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key">
          <Input type="text" value={String(config.triggerKey || '')}
            onChange={(e) => onChange((d: any) => { d.triggerKey = e.target.value || undefined; })}
            placeholder="Required if Instance ID is empty"
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Instance ID">
          <Input type="text" value={String(config.triggerInstanceId || '')}
            onChange={(e) => onChange((d: any) => { d.triggerInstanceId = e.target.value || undefined; })}
            placeholder="Required if Key is empty"
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-primary-text/75">Extensions</span>
          <ChooseFromExistingVnextComponentButton
            category="extensions"
            onClick={() => setExtensionPickerOpen(true)}
            disabled={!canPickExisting}
            label="Choose existing extension"
            title={
              canPickExisting
                ? 'Pick an extension from workspace JSON files'
                : 'Requires an open project and vnext.config.json with paths'
            }
          />
        </div>
        <TagEditor
          tags={extensions}
          onChange={(tags) => onChange((d: any) => { d.extensions = tags.length > 0 ? tags : undefined; })}
          placeholder="Add extension"
        />
      </div>
      <DaprToggleField value={config.useDapr as boolean | undefined} onChange={onChange} />
      <HttpSettingsFields config={config} onChange={onChange} />
      <ChooseExistingVnextComponentDialog
        open={extensionPickerOpen}
        onOpenChange={setExtensionPickerOpen}
        category="extensions"
        onSelect={handleExtensionSelected}
        title="Choose an extension"
        description="Select an extension JSON from your workspace paths to add to the extensions list."
      />
    </div>
  );
}
