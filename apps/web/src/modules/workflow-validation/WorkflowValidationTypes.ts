import type { ApiResponse } from '@vnext-forge/app-contracts';
import type { ValidationSeverity } from './WorkflowValidationSchema';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  message: string;
  path?: string;
  nodeId?: string;
  edgeId?: string;
  rule: string;
}

export interface WorkflowValidationResult {
  issues: ValidationIssue[];
}

export type WorkflowValidationResponse = ApiResponse<WorkflowValidationResult>;
