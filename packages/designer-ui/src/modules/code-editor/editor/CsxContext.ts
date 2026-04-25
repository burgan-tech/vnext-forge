/* ────────────── CSX Script Context ────────────── */

/**
 * Task type names matching vnext-runtime task definitions.
 * Numbers from task-editor/forms/index.ts taskFormMap.
 */
export type CsxTaskType =
  | 'HttpTask'
  | 'DaprPubSubTask'
  | 'DaprServiceTask'
  | 'DaprBindingTask'
  | 'ScriptTask'
  | 'StartTask'
  | 'DirectTriggerTask'
  | 'GetInstanceDataTask'
  | 'SubProcessTask'
  | 'GetInstancesTask';

/**
 * Maps numeric task type IDs (from workflow JSON attributes.type) to CsxTaskType.
 * Source: task-editor/forms/index.ts
 */
export const TASK_TYPE_MAP: Record<string, CsxTaskType> = {
  '3': 'DaprServiceTask',
  '4': 'DaprPubSubTask',
  '5': 'ScriptTask',
  '6': 'HttpTask',
  '7': 'DaprBindingTask',
  '11': 'StartTask',
  '12': 'DirectTriggerTask',
  '13': 'GetInstanceDataTask',
  '14': 'SubProcessTask',
  '15': 'GetInstancesTask',
};

/** Reverse map: name → type number */
export const TASK_NAME_TO_TYPE: Record<CsxTaskType, string> = Object.fromEntries(
  Object.entries(TASK_TYPE_MAP).map(([k, v]) => [v, k])
) as Record<CsxTaskType, string>;

/** Human-readable labels */
export const TASK_TYPE_LABELS: Record<CsxTaskType, string> = {
  HttpTask: 'HTTP Task',
  DaprPubSubTask: 'Dapr PubSub',
  DaprServiceTask: 'Dapr Service',
  DaprBindingTask: 'Dapr Binding',
  ScriptTask: 'Script Task',
  StartTask: 'Start Task',
  DirectTriggerTask: 'Direct Trigger',
  GetInstanceDataTask: 'Get Instance Data',
  SubProcessTask: 'Sub Process',
  GetInstancesTask: 'Get Instances',
};
