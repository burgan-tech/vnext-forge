/** Labels mirrored from the editor pickers (TaskTypePicker, ExtensionTypePicker,
 *  ExtensionScopePicker, FunctionScopePicker, ViewEditorPanel). Update together. */

/**
 * Task `attributes.type` is a string in the component schema, so keys are
 * strings here. Entries 1, 5, 8 and 9 have no picker entry (not offered by the
 * designer) but can still appear in runtime documents, so they are labeled too.
 */
export const TASK_TYPE_LABELS: Record<string, string> = {
  '1': 'Dapr HTTP Endpoint',
  '2': 'Dapr Binding',
  '3': 'Dapr Service Invocation',
  '4': 'Dapr PubSub',
  '5': 'Human Task',
  '6': 'HTTP Request',
  '7': 'Script (C#)',
  '8': 'Condition Task',
  '9': 'Timer Task',
  '10': 'Notification Task',
  '11': 'Start Workflow',
  '12': 'Direct Trigger',
  '13': 'Get Instance Data',
  '14': 'SubProcess / Start Trigger',
  '15': 'Get Instances',
  '16': 'SOAP Request',
  '17': 'State Store',
  '18': 'Cache Aside',
  '19': 'Get Instance',
  '20': 'Dapr Conversation',
};

export const EXTENSION_TYPE_LABELS: Record<number, string> = {
  1: 'Global',
  2: 'Global + Requested',
  3: 'Defined Flows',
  4: 'Defined + Requested',
};

export const EXTENSION_SCOPE_LABELS: Record<number, string> = {
  1: 'Get Instance',
  2: 'Get All Instances',
  3: 'Everywhere',
};

export const FUNCTION_SCOPE_LABELS: Record<string, string> = {
  I: 'Instance',
  F: 'Workflow',
  D: 'Domain',
};

/**
 * View `attributes.type` is numeric (`ViewType`) on the wire; keys are stringified
 * here so callers look up with `VIEW_TYPE_LABELS[String(type)]`.
 */
export const VIEW_TYPE_LABELS: Record<string, string> = {
  '1': 'JSON',
  '2': 'HTML',
  '3': 'Markdown',
  '4': 'Deep Link',
  '5': 'HTTP',
  '6': 'URN',
};
