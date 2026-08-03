import { useMemo, type ComponentType } from 'react';

import { Badge } from '../../ui/Badge.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { DaprBindingTaskForm } from '../task-editor/forms/DaprBindingTaskForm.js';
import { DaprConversationTaskForm } from '../task-editor/forms/DaprConversationTaskForm.js';
import { DaprPubSubTaskForm } from '../task-editor/forms/DaprPubSubTaskForm.js';
import { DaprServiceTaskForm } from '../task-editor/forms/DaprServiceTaskForm.js';
import { HttpTaskForm } from '../task-editor/forms/HttpTaskForm.js';
import { NotificationTaskForm } from '../task-editor/forms/NotificationTaskForm.js';
import { ScriptTaskForm } from '../task-editor/forms/ScriptTaskForm.js';
import { SoapTaskForm } from '../task-editor/forms/SoapTaskForm.js';
import { StateStoreTaskForm } from '../task-editor/forms/StateStoreTaskForm.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { TASK_TYPE_LABELS } from './readonlyLabels.js';
import { ReadOnlyConfigFields } from './shared/ReadOnlyConfigFields.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { noopChange, ReadOnlySectionCard } from './shared/ReadOnlySectionCard.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';
import { toDisplayText } from './shared/readonlyText.js';

interface TaskFormProps {
  config: Record<string, unknown>;
  onChange: (updater: (draft: never) => void) => void;
}

/**
 * Only forms verified free of store/transport imports are reused here
 * (imported by direct path — the forms barrel drags store-coupled forms).
 * Store-coupled task types render through the generic ReadOnlyConfigFields
 * fallback instead.
 */
const READONLY_TASK_FORM_MAP: Record<string, ComponentType<TaskFormProps>> = {
  '2': DaprBindingTaskForm,
  '3': DaprServiceTaskForm,
  '4': DaprPubSubTaskForm,
  '6': HttpTaskForm,
  '7': ScriptTaskForm,
  '10': NotificationTaskForm,
  '16': SoapTaskForm,
  '17': StateStoreTaskForm,
  '20': DaprConversationTaskForm,
};

export interface TaskDetailCoreProps {
  json: Record<string, unknown>;
}

/** Read-only designer view of a task component document. */
export function TaskDetailCore({ json: raw }: TaskDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('task', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const taskType = toDisplayText(attrs.type);
  const config = (attrs.config ?? {}) as Record<string, unknown>;
  const typeLabel = taskType ? (TASK_TYPE_LABELS[taskType] ?? `Type ${taskType}`) : '—';
  const FormComponent = READONLY_TASK_FORM_MAP[taskType];

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="Task Metadata">
          <ReadOnlyValueField label="Task Type" value={typeLabel} />
        </ReadOnlyMetadataSection>

        <ReadOnlySectionCard
          title="Configuration"
          description="Type-specific configuration for this task."
          badge={
            <Badge variant="secondary" className="text-xs">
              {typeLabel}
            </Badge>
          }>
          {FormComponent ? (
            <FormComponent config={config} onChange={noopChange} />
          ) : (
            <ReadOnlyConfigFields config={config} />
          )}
        </ReadOnlySectionCard>
      </div>
    </FormReadOnlyProvider>
  );
}
