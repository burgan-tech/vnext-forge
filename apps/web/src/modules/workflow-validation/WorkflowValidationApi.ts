import {
  ERROR_CODES,
  VnextForgeError,
  failureFromError,
  isFailure,
  success,
} from '@vnext-forge/app-contracts';
import { callApi } from '@shared/api/client';
import { toVnextError } from '@shared/lib/error/vNextErrorHelpers';
import { validateWorkflow } from './ValidationEngine';
import {
  parseServerValidationResult,
  type ServerValidationIssue,
} from './WorkflowValidationSchema';
import type { ValidationIssue, WorkflowValidationResponse } from './WorkflowValidationTypes';

export async function validateWorkflowDefinition(
  workflow: unknown,
): Promise<WorkflowValidationResponse> {
  try {
    const localIssues = validateWorkflow(workflow);
    const remoteResult = await callApi<unknown>({
      method: 'validate.workflow',
      params: { content: workflow },
    });

    if (isFailure(remoteResult)) {
      return remoteResult;
    }

    const parsedRemoteResult = parseServerValidationPayload(remoteResult.data);

    return success({
      issues: mergeIssues(
        localIssues,
        mapRemoteIssues(parsedRemoteResult.errors, 'error'),
        mapRemoteIssues(parsedRemoteResult.warnings, 'warning'),
      ),
    });
  } catch (value) {
    return failureFromError(toVnextError(value, 'Workflow could not be validated.'));
  }
}

function mergeIssues(...issueGroups: ValidationIssue[][]): ValidationIssue[] {
  const seen = new Set<string>();
  const merged: ValidationIssue[] = [];

  for (const issue of issueGroups.flat()) {
    const signature = [issue.severity, issue.rule, issue.nodeId ?? '', issue.message].join('::');

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    merged.push(issue);
  }

  return merged;
}

function mapRemoteIssues(
  entries: ServerValidationIssue[],
  severity: ValidationIssue['severity'],
): ValidationIssue[] {
  return entries.map((entry, index) => {
    const normalized = normalizeRemoteIssue(entry);

    return {
      id: `remote-${severity}-${index + 1}`,
      severity,
      message: normalized.message,
      rule: normalized.rule,
      ...(normalized.nodeId ? { nodeId: normalized.nodeId } : {}),
      ...(normalized.path ? { path: normalized.path } : {}),
    };
  });
}

function normalizeRemoteIssue(entry: unknown): {
  message: string;
  rule: string;
  nodeId?: string;
  path?: string;
} {
  if (typeof entry === 'string' && entry.trim().length > 0) {
    return { message: entry, rule: 'server-validation' };
  }

  if (isRecord(entry)) {
    const message =
      typeof entry.message === 'string' && entry.message.trim().length > 0
        ? entry.message
        : 'Server validation reported an issue.';
    const rule =
      typeof entry.rule === 'string' && entry.rule.trim().length > 0
        ? entry.rule
        : 'server-validation';

    return {
      message,
      rule,
      ...(typeof entry.nodeId === 'string' ? { nodeId: entry.nodeId } : {}),
      ...(typeof entry.path === 'string' ? { path: entry.path } : {}),
    };
  }

  return {
    message: 'Server validation reported an issue.',
    rule: 'server-validation',
  };
}

function parseServerValidationPayload(value: unknown) {
  try {
    return parseServerValidationResult(value);
  } catch (error) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'Validation response could not be verified.',
      {
        source: 'workflow-validation/WorkflowValidationApi.parseServerValidationPayload',
        layer: 'transport',
        details: {
          reason: error instanceof Error ? error.message : 'unknown-schema-error',
        },
      },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
