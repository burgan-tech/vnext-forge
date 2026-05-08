import type { ComponentType } from 'react';
import { HttpTaskForm } from './HttpTaskForm';
import { DaprPubSubTaskForm } from './DaprPubSubTaskForm';
import { DaprServiceTaskForm } from './DaprServiceTaskForm';
import { DaprBindingTaskForm } from './DaprBindingTaskForm';
import { ScriptTaskForm } from './ScriptTaskForm';
import { StartTaskForm } from './StartTaskForm';
import { DirectTriggerTaskForm } from './DirectTriggerTaskForm';
import { GetInstanceDataTaskForm } from './GetInstanceDataTaskForm';
import { SubProcessTaskForm } from './SubProcessTaskForm';
import { GetInstancesTaskForm } from './GetInstancesTaskForm';

interface TaskFormProps {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

export const taskFormMap: Record<string, ComponentType<TaskFormProps>> = {
  '2': DaprBindingTaskForm,
  '3': DaprServiceTaskForm,
  '4': DaprPubSubTaskForm,
  '6': HttpTaskForm,
  '7': ScriptTaskForm,
  '11': StartTaskForm,
  '12': DirectTriggerTaskForm,
  '13': GetInstanceDataTaskForm,
  '14': SubProcessTaskForm,
  '15': GetInstancesTaskForm,
};
