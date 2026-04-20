import { ERROR_CODES, type ErrorCode } from './error-codes.js';

/**
 * UI severity for a given `ErrorCode`.
 *
 *  - `info`    — informational; no recovery action required.
 *  - `warning` — degraded but expected operational state (runtime offline,
 *                 missing optional resource, rate limiting). UI may surface
 *                 a warning banner or yellow toast instead of a red error.
 *  - `error`   — actionable failure that the user / operator must address.
 */
export type ErrorSeverity = 'info' | 'warning' | 'error';

/**
 * Suggested recovery action label, kept short for UI buttons.
 *  - `'retry'`        — same operation will likely succeed on retry.
 *  - `'reconnect'`    — runtime / network needs to come back up first.
 *  - `'reauthenticate'` — user must re-login.
 *  - `'fix-input'`    — user input must change before retry.
 *  - `'contact-support'` — manual operator action expected.
 *  - `null`           — no recovery hint, surface the message only.
 */
export type ErrorRecoveryAction =
  | 'retry'
  | 'reconnect'
  | 'reauthenticate'
  | 'fix-input'
  | 'contact-support'
  | null;

export interface ErrorPresentation {
  severity: ErrorSeverity;
  recovery: ErrorRecoveryAction;
}

const DEFAULT_PRESENTATION: ErrorPresentation = {
  severity: 'error',
  recovery: 'contact-support',
};

/**
 * Single source of truth mapping every `ErrorCode` to its UI presentation
 * (severity + recovery hint). Components MUST consume this map instead of
 * string-matching on `code` or `message`.
 *
 * Ordering mirrors `error-codes.ts` so the two stay easy to keep in sync.
 * When adding a new code there, add an entry here in the same PR.
 */
export const ERROR_PRESENTATION: Readonly<Record<ErrorCode, ErrorPresentation>> = Object.freeze({
  // ── File ───────────────────────────────────────────────────────────────
  [ERROR_CODES.FILE_NOT_FOUND]: { severity: 'warning', recovery: 'retry' },
  [ERROR_CODES.FILE_READ_ERROR]: { severity: 'error', recovery: 'retry' },
  [ERROR_CODES.FILE_WRITE_ERROR]: { severity: 'error', recovery: 'retry' },
  [ERROR_CODES.FILE_DELETE_ERROR]: { severity: 'error', recovery: 'retry' },
  [ERROR_CODES.FILE_ALREADY_EXISTS]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.FILE_INVALID_PATH]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.FILE_PERMISSION_DENIED]: { severity: 'error', recovery: 'contact-support' },

  // ── Project ────────────────────────────────────────────────────────────
  [ERROR_CODES.PROJECT_NOT_FOUND]: { severity: 'warning', recovery: 'retry' },
  [ERROR_CODES.PROJECT_ALREADY_EXISTS]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.PROJECT_INVALID_CONFIG]: { severity: 'error', recovery: 'fix-input' },
  [ERROR_CODES.PROJECT_LOAD_ERROR]: { severity: 'error', recovery: 'retry' },
  [ERROR_CODES.PROJECT_SAVE_ERROR]: { severity: 'error', recovery: 'retry' },

  // ── Workflow ───────────────────────────────────────────────────────────
  [ERROR_CODES.WORKFLOW_NOT_FOUND]: { severity: 'warning', recovery: 'retry' },
  [ERROR_CODES.WORKFLOW_INVALID]: { severity: 'error', recovery: 'fix-input' },
  [ERROR_CODES.WORKFLOW_PARSE_ERROR]: { severity: 'error', recovery: 'fix-input' },
  [ERROR_CODES.WORKFLOW_SAVE_ERROR]: { severity: 'error', recovery: 'retry' },
  [ERROR_CODES.WORKFLOW_VERSION_MISMATCH]: { severity: 'warning', recovery: 'contact-support' },
  [ERROR_CODES.WORKFLOW_DUPLICATE_STATE]: { severity: 'error', recovery: 'fix-input' },
  [ERROR_CODES.WORKFLOW_MISSING_INITIAL_STATE]: { severity: 'error', recovery: 'fix-input' },
  [ERROR_CODES.WORKFLOW_UNREACHABLE_STATE]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.WORKFLOW_CYCLE_DETECTED]: { severity: 'error', recovery: 'fix-input' },
  [ERROR_CODES.WORKFLOW_INVALID_TRANSITION]: { severity: 'error', recovery: 'fix-input' },

  // ── Runtime ────────────────────────────────────────────────────────────
  // Runtime offline is an expected operational state, not a hard error,
  // hence `warning` + `reconnect` instead of `error`. The web shell
  // dashboard explicitly relies on this so that a missing runtime does
  // not show as a red banner.
  [ERROR_CODES.RUNTIME_NOT_AVAILABLE]: { severity: 'warning', recovery: 'reconnect' },
  [ERROR_CODES.RUNTIME_CONNECTION_FAILED]: { severity: 'warning', recovery: 'reconnect' },
  [ERROR_CODES.RUNTIME_EXECUTION_FAILED]: { severity: 'error', recovery: 'retry' },
  [ERROR_CODES.RUNTIME_TIMEOUT]: { severity: 'warning', recovery: 'retry' },
  [ERROR_CODES.RUNTIME_INVALID_RESPONSE]: { severity: 'error', recovery: 'contact-support' },

  // ── Simulation ─────────────────────────────────────────────────────────
  [ERROR_CODES.SIMULATION_INVALID_INPUT]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.SIMULATION_STATE_NOT_FOUND]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.SIMULATION_NO_MATCHING_TRANSITION]: { severity: 'info', recovery: null },
  [ERROR_CODES.SIMULATION_MAX_STEPS_EXCEEDED]: { severity: 'warning', recovery: 'fix-input' },

  // ── Git ────────────────────────────────────────────────────────────────
  [ERROR_CODES.GIT_NOT_INITIALIZED]: { severity: 'info', recovery: null },
  [ERROR_CODES.GIT_COMMIT_FAILED]: { severity: 'error', recovery: 'retry' },
  [ERROR_CODES.GIT_PUSH_FAILED]: { severity: 'error', recovery: 'retry' },
  [ERROR_CODES.GIT_CONFLICT]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.GIT_INVALID_REF]: { severity: 'warning', recovery: 'fix-input' },

  // ── API / Transport ────────────────────────────────────────────────────
  [ERROR_CODES.API_BAD_REQUEST]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.API_UNAUTHORIZED]: { severity: 'warning', recovery: 'reauthenticate' },
  [ERROR_CODES.API_FORBIDDEN]: { severity: 'error', recovery: 'contact-support' },
  [ERROR_CODES.API_NOT_FOUND]: { severity: 'warning', recovery: 'retry' },
  [ERROR_CODES.API_CONFLICT]: { severity: 'warning', recovery: 'retry' },
  [ERROR_CODES.API_UNPROCESSABLE]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.API_PAYLOAD_TOO_LARGE]: { severity: 'warning', recovery: 'fix-input' },
  [ERROR_CODES.API_RATE_LIMITED]: { severity: 'warning', recovery: 'retry' },
  [ERROR_CODES.API_INTERNAL_ERROR]: { severity: 'error', recovery: 'retry' },

  // ── Internal ───────────────────────────────────────────────────────────
  [ERROR_CODES.INTERNAL_UNEXPECTED]: { severity: 'error', recovery: 'contact-support' },
  [ERROR_CODES.INTERNAL_NOT_IMPLEMENTED]: { severity: 'info', recovery: null },
  [ERROR_CODES.INTERNAL_ASSERTION_FAILED]: { severity: 'error', recovery: 'contact-support' },
});

/**
 * Look up the UI presentation for an `ErrorCode`. Falls back to the
 * conservative "show as error, suggest contacting support" presentation
 * when the code is unknown — this is intentionally noisy so that adding
 * a new code without updating `ERROR_PRESENTATION` does not silently
 * downgrade the UI.
 */
export function getErrorPresentation(code: ErrorCode | string | undefined): ErrorPresentation {
  if (typeof code !== 'string') return DEFAULT_PRESENTATION;
  return (
    ERROR_PRESENTATION[code as ErrorCode] ?? DEFAULT_PRESENTATION
  );
}
