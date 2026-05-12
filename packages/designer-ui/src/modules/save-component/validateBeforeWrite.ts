import { isFailure } from '@vnext-forge-studio/app-contracts';

import { callApi } from '../../api/client';
import { createLogger } from '../../lib/logger/createLogger';
import { showNotification } from '../../notification/notification-port';

const logger = createLogger('save-component/validateBeforeWrite');

export interface ValidationEntry {
  path: string;
  message: string;
  params?: Record<string, unknown>;
}

export interface ValidationGateResult {
  valid: boolean;
  errors: ValidationEntry[];
  warnings: ValidationEntry[];
  /** `true` when the validation RPC was unreachable and the result is a fallback. */
  skipped: boolean;
}

interface ServerValidationResult {
  valid: boolean;
  errors: ValidationEntry[];
  warnings: ValidationEntry[];
}

const SKIPPED_VALID: ValidationGateResult = {
  valid: true,
  errors: [],
  warnings: [],
  skipped: true,
};

async function runValidationRpc(
  method: string,
  params: Record<string, unknown>,
): Promise<ValidationGateResult> {
  try {
    const result = await callApi<ServerValidationResult>({ method, params });

    if (isFailure(result)) {
      const detail = result.error.message || 'unknown error';
      logger.warn(`${method} returned failure envelope; allowing save`, result.error);
      showNotification({
        kind: 'warning',
        message: `Validation skipped (${detail}) — saving without validation.`,
      });
      return SKIPPED_VALID;
    }

    const data = result.data;
    return {
      valid: data.valid,
      errors: (data.errors ?? []).map((e) => ({
        path: e.path ?? '',
        message: e.message,
        ...(e.params ? { params: e.params } : {}),
      })),
      warnings: (data.warnings ?? []).map((e) => ({
        path: e.path ?? '',
        message: e.message,
        ...(e.params ? { params: e.params } : {}),
      })),
      skipped: false,
    };
  } catch (err) {
    logger.warn(`Pre-save ${method} failed; allowing save`, err);
    showNotification({
      kind: 'warning',
      message: 'Validation service unreachable — saving without validation.',
    });
    return SKIPPED_VALID;
  }
}

/**
 * Validate a component document against `@burgan-tech/vnext-schema` via the
 * `validate/component` RPC before writing to disk.
 *
 * On transport error the function returns `{ valid: true, skipped: true }`
 * and shows a warning notification so the caller can proceed with saving.
 */
export async function validateComponentBeforeWrite(
  content: unknown,
  type: string,
  schemaVersion?: string,
): Promise<ValidationGateResult> {
  const params: Record<string, unknown> = { content, type };
  if (schemaVersion) {
    params.schemaVersion = schemaVersion;
  }
  return runValidationRpc('validate/component', params);
}

/**
 * Validate a workflow document against `@burgan-tech/vnext-schema` via the
 * `validate/workflow` RPC before writing to disk.
 *
 * On transport error the function returns `{ valid: true, skipped: true }`
 * and shows a warning notification so the caller can proceed with saving.
 */
export async function validateWorkflowBeforeWrite(
  content: unknown,
  schemaVersion?: string,
): Promise<ValidationGateResult> {
  const params: Record<string, unknown> = { content };
  if (schemaVersion) {
    params.schemaVersion = schemaVersion;
  }
  return runValidationRpc('validate/workflow', params);
}

/**
 * Format a `ValidationGateResult` into a single-line summary suitable for
 * a notification message (e.g. "attributes/type: must be string (+2 more)").
 */
export function formatValidationSummary(
  result: ValidationGateResult,
  fallbackLabel: string,
): string {
  const errors = result.errors;
  if (errors.length === 0) return 'Validation failed';
  const first = errors[0];
  const label = first.path || fallbackLabel;
  const tail = errors.length > 1 ? ` (+${errors.length - 1} more)` : '';
  return `${label}: ${first.message}${tail}`;
}
