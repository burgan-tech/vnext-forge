export type TaskExecutionStatus = 'Success' | 'Failed' | 'Running';

export interface TaskError {
  message: string;
  exceptionType: string;
  stackTrace: string;
}

export interface TaskAction {
  id: string;
  status: 'Processing' | 'Completed' | 'Failed';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  detail: object;
}

export interface TaskExecution {
  id: string;
  taskName: string;
  taskType: 'Http' | 'Script';
  instanceId: string;
  instanceKey: string;
  workflow: string;
  triggerType: 'State' | 'Transition';
  triggerLocation: string;
  status: TaskExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs: number;
  input?: object;
  output?: object;
  request?: { method: string; url: string; body: object };
  response?: { statusCode: number; body: object };
  actions: TaskAction[];
  error?: TaskError;
}

export interface TaskExecutionListItem {
  id: string;
  taskName: string;
  taskType: 'Http' | 'Script';
  instanceId: string;
  instanceKey: string;
  workflow: string;
  durationMs: number;
  status: TaskExecutionStatus;
  startedAt: string;
  error?: string;
}

export type FunctionExecutionStatus = 'Success' | 'Failed' | 'Running';

export interface FunctionExecution {
  id: string;
  functionName: string;
  returnType: string;
  instanceId: string;
  instanceKey: string;
  workflow: string;
  durationMs: number;
  status: FunctionExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: { message: string; exceptionType: string };
}
