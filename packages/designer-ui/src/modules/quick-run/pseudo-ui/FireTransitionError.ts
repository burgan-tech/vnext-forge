import type { ParsedValidationFailure } from './parseValidationFailure';

/**
 * Carries the structured validation failure from the engine's
 * `fireTransition` 4xx response across the delegate boundary. The
 * SDK wraps `delegate.onAction` errors as plain `Error` instances,
 * so when we throw this from the delegate the surface layer
 * (`PseudoUiViewSurface.wrappedDelegate`) can `instanceof`-check it
 * and render the per-field details.
 */
export class FireTransitionError extends Error {
  readonly name = 'FireTransitionError';
  readonly code: string;
  readonly validation: ParsedValidationFailure | null;
  /** Raw `error.details` from the ApiFailure for last-resort debug. */
  readonly details: unknown;

  constructor(args: {
    message: string;
    code: string;
    validation: ParsedValidationFailure | null;
    details?: unknown;
  }) {
    super(args.message);
    this.code = args.code;
    this.validation = args.validation;
    this.details = args.details;
  }
}
