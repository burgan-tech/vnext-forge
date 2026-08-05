import type { FunctionScope } from '@vnext-forge-studio/vnext-types';

import { isAuthorizationFailure } from './functionRunStatus';
import type { FunctionExchange, FunctionInfo } from './types/functionRun.types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A payload counts as usable info only when it is an object carrying `function.href`. */
function isUsableInfo(json: unknown): json is FunctionInfo {
  if (!isPlainObject(json)) return false;
  const fn = json.function;
  return isPlainObject(fn) && typeof fn.href === 'string' && fn.href.length > 0;
}

export interface InfoReadResult {
  info: FunctionInfo | null;
  /** User-facing explanation when `info` is null. */
  error: string | null;
}

/**
 * Maps an `/info` exchange onto what the runner shows.
 *
 * Each non-2xx gets its own sentence because they mean genuinely different
 * things and send the user to different places: a 403 is a permissions
 * problem (discovery and execution share one access policy), a 404 means the
 * key has no `sys-functions` component at all — which is the expected answer
 * for a built-in system function like `state` or `view`.
 */
export function readInfoExchange(exchange: FunctionExchange): InfoReadResult {
  const { status } = exchange;

  if (status === 404) {
    return {
      info: null,
      error:
        'This function key has no sys-functions component (expected for a built-in system function such as state, view, or data).',
    };
  }

  if (isAuthorizationFailure(status)) {
    return {
      info: null,
      error: 'You are not allowed to view this function\'s contract. Check your auth headers and the function\'s roles.',
    };
  }

  if (status < 200 || status >= 300) {
    return { info: null, error: `The function info request failed with status ${status}.` };
  }

  const json = 'json' in exchange ? exchange.json : undefined;
  if (!isUsableInfo(json)) {
    return { info: null, error: 'The function info response could not be read.' };
  }

  return { info: json, error: null };
}

export interface InvokeGate {
  canInvoke: boolean;
  /** Non-null exactly when `canInvoke` is false. Shown next to the button. */
  reason: string | null;
}

/**
 * Whether Invoke is enabled, and if not, which specific thing is missing.
 *
 * Names the field rather than saying "incomplete" — a disabled control with
 * no explanation is the failure mode this whole surface is designed against.
 */
export function computeInvokeGate(input: {
  info: FunctionInfo | null;
  scope: FunctionScope;
  workflowKey: string;
  instanceId: string;
}): InvokeGate {
  const { info, scope, workflowKey, instanceId } = input;

  if (!info) {
    return { canInvoke: false, reason: 'Waiting for the function contract to load.' };
  }

  if (scope !== 'D') {
    if (workflowKey.trim() === '') {
      return { canInvoke: false, reason: 'Enter a workflow key to run this function.' };
    }
    if (instanceId.trim() === '') {
      return { canInvoke: false, reason: 'Enter an instance id to run this function.' };
    }
  }

  return { canInvoke: true, reason: null };
}
