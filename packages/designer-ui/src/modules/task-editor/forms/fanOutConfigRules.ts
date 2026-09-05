/**
 * Design-time rules for the FanOut task (type 21) config form.
 *
 * Mirrors the runtime's parse-time checks (`FanOutTask.Configure`) plus the
 * designer-only hints from `vnext/docs/integration/forge-fanout-task-implementation.md`
 * §3.2 / §4 that the JSON schema deliberately does not encode. Pure function so
 * the form stays thin and the rules are unit-testable.
 *
 * Keys are config paths (`task.key`, `execution.itemTimeoutSeconds`, …) so the
 * form can attach each message to the field it concerns.
 */

export const FAN_OUT_DEFAULTS = {
  maxDegreeOfParallelism: 4,
  itemTimeoutSeconds: 30,
  batchTimeoutSeconds: 120,
  joinPolicy: 'allSettled',
  resultKey: 'fanOutResults',
} as const;

/** Above this the runtime doc (§6.2) says to warn: an unbounded fan-out DDoSes the inner task's target. */
export const FAN_OUT_PARALLELISM_WARN_ABOVE = 16;

export const FAN_OUT_JOIN_POLICIES = ['all', 'allSettled', 'quorum', 'firstSuccess'] as const;
export type FanOutJoinPolicyValue = (typeof FAN_OUT_JOIN_POLICIES)[number];

export interface FanOutRuleResult {
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** `$.a.b` — property navigation only; no filters, wildcards, indices or slices. */
export function isValidItemsPath(path: string): boolean {
  if (!path.startsWith('$.')) return false;
  if (/[[\]*?]/.test(path) || path.includes('..')) return false;
  return path.length > 2;
}

export function validateFanOutConfig(config: Rec | undefined): FanOutRuleResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  const c = config ?? {};

  // Inner task — the runtime errors per missing property.
  const task = rec(c.task) ?? {};
  for (const field of ['key', 'domain', 'flow', 'version'] as const) {
    if (!str(task[field]).trim()) errors[`task.${field}`] = 'Required.';
  }

  // Items path (only validated when present; absence means "ItemSelector in the mapping").
  const itemsPath = str(c.itemsPath);
  if (itemsPath && !isValidItemsPath(itemsPath)) {
    errors.itemsPath = itemsPath.startsWith('$.')
      ? 'Use property navigation only ($.a.b). Filters, wildcards, indices and slices are not supported.'
      : 'Must start with "$." (e.g. $.documents.online).';
  }

  // Mode
  if (c.mode !== undefined && c.mode !== 'inline') {
    errors.mode = 'Only "inline" is supported by the runtime.';
  }

  // Execution
  const execution = rec(c.execution) ?? {};
  const parallelism = num(execution.maxDegreeOfParallelism);
  const itemTimeout = num(execution.itemTimeoutSeconds);
  const batchTimeout = num(execution.batchTimeoutSeconds);
  if (execution.maxDegreeOfParallelism !== undefined && (parallelism === undefined || parallelism < 1)) {
    errors['execution.maxDegreeOfParallelism'] = 'Must be an integer of at least 1.';
  } else if (parallelism !== undefined && parallelism > FAN_OUT_PARALLELISM_WARN_ABOVE) {
    warnings['execution.maxDegreeOfParallelism'] =
      `Above ${FAN_OUT_PARALLELISM_WARN_ABOVE}: every item hits the inner task's target concurrently. Make sure it can take the load.`;
  }
  if (execution.itemTimeoutSeconds !== undefined && (itemTimeout === undefined || itemTimeout < 1)) {
    errors['execution.itemTimeoutSeconds'] = 'Must be an integer of at least 1.';
  }
  if (execution.batchTimeoutSeconds !== undefined && (batchTimeout === undefined || batchTimeout < 1)) {
    errors['execution.batchTimeoutSeconds'] = 'Must be an integer of at least 1.';
  }
  const effectiveItem = itemTimeout ?? FAN_OUT_DEFAULTS.itemTimeoutSeconds;
  const effectiveBatch = batchTimeout ?? FAN_OUT_DEFAULTS.batchTimeoutSeconds;
  if (
    !errors['execution.itemTimeoutSeconds'] &&
    !errors['execution.batchTimeoutSeconds'] &&
    effectiveItem > effectiveBatch
  ) {
    const msg = `Item timeout (${effectiveItem}s) cannot exceed the batch timeout (${effectiveBatch}s).`;
    errors['execution.itemTimeoutSeconds'] = msg;
    errors['execution.batchTimeoutSeconds'] = msg;
  }

  // Join
  const join = rec(c.join) ?? {};
  const policy = join.policy === undefined ? FAN_OUT_DEFAULTS.joinPolicy : join.policy;
  if (!FAN_OUT_JOIN_POLICIES.includes(policy as FanOutJoinPolicyValue)) {
    errors['join.policy'] = `Unknown policy. Use one of: ${FAN_OUT_JOIN_POLICIES.join(', ')}.`;
  }
  const minSuccess = num(join.minSuccess);
  if (policy === 'quorum') {
    if (minSuccess === undefined || minSuccess < 1) {
      errors['join.minSuccess'] = 'Required for quorum: the minimum number of successful items (at least 1).';
    }
  } else if (join.minSuccess !== undefined) {
    warnings['join.minSuccess'] = 'Ignored for this policy — only quorum reads minSuccess. Did you mean quorum?';
  }
  if (join.resultKey !== undefined && !str(join.resultKey).trim()) {
    errors['join.resultKey'] = 'Cannot be empty; leave it unset to use the default.';
  }
  if (policy === 'quorum' || policy === 'firstSuccess') {
    warnings['join.policy'] =
      'Threshold policy: an empty batch (0 items) fails. Use "all" or "allSettled" if "no items" should succeed.';
  }

  return { errors, warnings };
}
