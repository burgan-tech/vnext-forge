export type InstanceStatus = 'A' | 'C';

export interface WorkflowInstance {
  id: string;
  key?: string;
  state: string;
  status: InstanceStatus;
  data?: Record<string, unknown>;
  tags?: string[];
  attributes?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  effectiveStateType?: number;
  effectiveStateSubType?: number;
}

export interface ActiveCorrelation {
  correlationId: string;
  workflowKey: string;
  instanceId: string;
  state: string;
  status: InstanceStatus;
}
