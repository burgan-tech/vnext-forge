import type { ErrorCode } from './error-codes.js';
import { USER_MESSAGES, DEFAULT_USER_MESSAGE } from './user-messages.js';

// ── Context ───────────────────────────────────────────────────────────────────

/**
 * The architectural layer where a `VnextForgeError` originated.
 * Used in structured logs to narrow down the source of a failure quickly.
 *
 * Layer order (outermost → innermost):
 *   transport → presentation → feature → entity → application → domain → infrastructure
 */
export type ErrorLayer =
  /** HTTP middleware, Hono RPC handlers, request/response pipeline. */
  | 'transport'
  /** UI components: pages, widgets, and shared UI primitives (apps/web). */
  | 'presentation'
  /** FSD feature slices: user-facing scenarios, use-case orchestration (features/*). */
  | 'feature'
  /** FSD entity layer: domain stores, conversion utilities (entities/*). */
  | 'entity'
  /** Application services: orchestrate domain logic and infrastructure (apps/server/services). */
  | 'application'
  /** Pure domain/business logic: validation rules, simulation, workflow engine (packages/workflow-system). */
  | 'domain'
  /** I/O and external access: file system, HTTP clients, runtime proxy, database. */
  | 'infrastructure';

export interface VnextForgeErrorContext {
  /** The function that threw the error, e.g. "FileService.writeFile" */
  source: string;
  /** The architectural layer where the error originated */
  layer: ErrorLayer;
  /** Optional additional data for debugging (server-side only) */
  details?: Record<string, unknown>;
}

// ── Log / User message shapes ─────────────────────────────────────────────────

export interface VnextForgeErrorLogEntry {
  code: ErrorCode;
  message: string;
  source: string;
  layer: ErrorLayer;
  traceId?: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface VnextForgeErrorUserMessage {
  code: ErrorCode;
  message: string;
  traceId?: string;
}

// ── VnextForgeError ───────────────────────────────────────────────────────────

/**
 * The canonical error type for all application layers.
 * Every `throw` should be a `VnextForgeError`.
 *
 * @example
 * throw new VnextForgeError(
 *   ERROR_CODES.FILE_NOT_FOUND,
 *   'Workflow file does not exist',
 *   { source: 'FileService.readWorkflow', layer: 'infrastructure' },
 * );
 */
export class VnextForgeError extends Error {
  readonly code: ErrorCode;
  readonly context: VnextForgeErrorContext;
  readonly traceId?: string;

  constructor(
    code: ErrorCode,
    message: string,
    context: VnextForgeErrorContext,
    traceId?: string,
  ) {
    super(message);
    this.name = 'VnextForgeError';
    this.code = code;
    this.context = context;
    this.traceId = traceId;

    // Maintains proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a plain object suitable for structured server-side logging.
   * Contains full technical detail — never send this to the client.
   */
  toLogEntry(): VnextForgeErrorLogEntry {
    return {
      code: this.code,
      message: this.message,
      source: this.context.source,
      layer: this.context.layer,
      traceId: this.traceId,
      details: this.context.details,
      stack: this.stack,
    };
  }

  /**
   * Returns a safe message object to expose to the end user.
   * Never exposes raw `.message` or internal details.
   */
  toUserMessage(): VnextForgeErrorUserMessage {
    return {
      code: this.code,
      message: USER_MESSAGES[this.code] ?? DEFAULT_USER_MESSAGE,
      traceId: this.traceId,
    };
  }
}

