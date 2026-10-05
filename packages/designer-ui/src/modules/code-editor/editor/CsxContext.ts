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
  '2': 'DaprBindingTask',
  '3': 'DaprServiceTask',
  '4': 'DaprPubSubTask',
  '6': 'HttpTask',
  '7': 'ScriptTask',
  '11': 'StartTask',
  '12': 'DirectTriggerTask',
  '13': 'GetInstanceDataTask',
  '14': 'SubProcessTask',
  '15': 'GetInstancesTask',
  // External HTTP (runtime type 22) is an HttpTask in scripts.
  '22': 'HttpTask',
};

/** Reverse map: name → type number */
export const TASK_NAME_TO_TYPE: Record<CsxTaskType, string> = Object.fromEntries(
  // First type wins, so HttpTask maps back to '6' rather than '22'.
  Object.entries(TASK_TYPE_MAP)
    .reverse()
    .map(([k, v]) => [v, k]),
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
