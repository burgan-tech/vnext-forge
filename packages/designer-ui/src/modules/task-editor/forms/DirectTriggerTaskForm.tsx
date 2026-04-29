import { useCallback, useRef, useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { TagEditor } from '../../../ui/TagEditor';
import {
  BodyJsonField,
  DaprToggleField,
  HttpSettingsFields,
  WorkflowRefFields,
  TransitionNameField,
  loadWorkflowTransitions,
} from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DirectTriggerTaskForm({ config, onChange }: Props) {
  const [availableTransitions, setAvailableTransitions] = useState<string[]>([]);
  const loadGenRef = useRef(0);

  const handleWorkflowSelected = useCallback(async (component: DiscoveredVnextComponent) => {
    const gen = ++loadGenRef.current;
    try {
      const transitions = await loadWorkflowTransitions(component.path);
      if (gen === loadGenRef.current) setAvailableTransitions(transitions);
    } catch {
      if (gen === loadGenRef.current) setAvailableTransitions([]);
    }
  }, []);

  return (
    <div className="space-y-3">
      <WorkflowRefFields config={config} onChange={onChange} onWorkflowSelected={handleWorkflowSelected} />
      <TransitionNameField
        value={String(config.transitionName || '')}
        onChange={onChange}
        availableTransitions={availableTransitions}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key">
          <Input type="text" value={String(config.triggerKey || '')}
            onChange={(e) => onChange((d: any) => { d.triggerKey = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Instance ID">
          <Input type="text" value={String(config.triggerInstanceId || '')}
            onChange={(e) => onChange((d: any) => { d.triggerInstanceId = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs" />
        </Field>
      </div>
      <Field label="Sync">
        <Select value={config.triggerSync === false ? 'false' : 'true'}
          onChange={(e) => onChange((d: any) => { d.triggerSync = e.target.value === 'true'; })}
          className="text-xs">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </Field>
      <Field label="Tags">
        <TagEditor
          tags={(config.triggerTags as string[]) || []}
          onChange={(tags) => onChange((d: any) => { d.triggerTags = tags.length > 0 ? tags : undefined; })}
          placeholder="Add tag"
        />
      </Field>
      <BodyJsonField value={config.body} onChange={onChange} />
      <DaprToggleField value={config.useDapr as boolean | undefined} onChange={onChange} />
      <HttpSettingsFields config={config} onChange={onChange} />
    </div>
  );
}
