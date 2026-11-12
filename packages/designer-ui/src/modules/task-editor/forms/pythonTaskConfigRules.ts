/**
 * Design-time rules for the Python Task (type 23) config form — mirrors the
 * vnext-schema 0.0.59 contract (closed config: `handler`, `input`,
 * `timeoutSeconds`) and flags the pre-0.0.103 inline-script shape, which the
 * runtime now rejects at publish. Pure so it stays unit-testable.
 */
import {
  PYTHON_TASK_HANDLER_PATTERN,
  PYTHON_TASK_TIMEOUT_MAX_SECONDS,
  PYTHON_TASK_TIMEOUT_MIN_SECONDS,
} from '@vnext-forge-studio/vnext-types';

/** Config keys of the old inline-script Python task that block publish. */
export const PYTHON_TASK_LEGACY_KEYS = ['script', 'executionMode'] as const;

const ALLOWED_KEYS = new Set(['handler', 'input', 'timeoutSeconds']);

export interface PythonTaskRuleResult {
  /** Keyed by config field (`handler`, `timeoutSeconds`, `config`). */
  errors: Record<string, string>;
  /** Legacy keys present in the config (`script`, `executionMode`). */
  legacyKeys: string[];
  /** Any other key the closed config rejects. */
  unknownKeys: string[];
}

export function pythonTaskConfigRules(config: Record<string, unknown>): PythonTaskRuleResult {
  const errors: Record<string, string> = {};

  const handler = typeof config.handler === 'string' ? config.handler : '';
  if (!handler) {
    errors.handler = 'Handler is required: the name of a handler registered in the domain’s Python runtime.';
  } else if (!PYTHON_TASK_HANDLER_PATTERN.test(handler)) {
    errors.handler = 'Use letters, digits, “_”, “.” or “-”, starting with a letter or “_” (max 128 characters).';
  }

  const timeout = config.timeoutSeconds;
  if (timeout !== undefined) {
    if (
      typeof timeout !== 'number' ||
      !Number.isInteger(timeout) ||
      timeout < PYTHON_TASK_TIMEOUT_MIN_SECONDS ||
      timeout > PYTHON_TASK_TIMEOUT_MAX_SECONDS
    ) {
      errors.timeoutSeconds = `Timeout must be a whole number from ${PYTHON_TASK_TIMEOUT_MIN_SECONDS} to ${PYTHON_TASK_TIMEOUT_MAX_SECONDS} seconds.`;
    }
  }

  const legacyKeys = PYTHON_TASK_LEGACY_KEYS.filter((k) => k in config);
  const unknownKeys = Object.keys(config).filter(
    (k) => !ALLOWED_KEYS.has(k) && !(PYTHON_TASK_LEGACY_KEYS as readonly string[]).includes(k),
  );
  if (legacyKeys.length > 0) {
    errors.config = `This task still carries ${legacyKeys.join(' / ')} from the inline-script Python task; runtime 0.0.103+ rejects it at publish. Move the code into a handler in the domain’s Python runtime and remove these fields.`;
  }
  return { errors, legacyKeys, unknownKeys };
}
