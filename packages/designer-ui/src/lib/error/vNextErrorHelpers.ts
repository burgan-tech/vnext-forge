import {
  ERROR_CODES,
  isFailure,
  type ApiFailure,
  type ApiResponse,
  VnextForgeError,
  type ErrorCode,
} from '@vnext-forge-studio/app-contracts';

const ERROR_SOURCE = 'designer-ui/lib/error/toVnextError';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_CODES;
}

function isResponseFailure(value: unknown): value is ApiFailure {
  return isRecord(value) && 'success' in value && value.success === false && isRecord(value.error);
}

function resolveMessage(value: unknown, fallbackMessage?: string): string {
  if (typeof fallbackMessage === 'string' && fallbackMessage.trim().length > 0) {
    return fallbackMessage;
  }

  if (isRecord(value) && typeof value.message === 'string' && value.message.trim().length > 0) {
    return value.message;
  }

  if (value instanceof Error && value.message.trim().length > 0) {
    return value.message;
  }

  return 'Unexpected error';
}

function createTransportError(
  code: ErrorCode,
  message: string,
  traceId?: string,
  details?: Record<string, unknown>,
): VnextForgeError {
  return new VnextForgeError(
    code,
    message,
    {
      source: ERROR_SOURCE,
      layer: 'transport',
      ...(details ? { details } : {}),
    },
    traceId,
  );
}

/**
 * Normalize any thrown value or ApiResponse failure into a VnextForgeError.
 * Use at the boundary where transport responses or unknown errors enter the UI.
 */
export function toVnextError(value: unknown, fallbackMessage?: string): VnextForgeError {
  if (value instanceof VnextForgeError) {
    return value;
  }

  if (isResponseFailure(value)) {
    return createTransportError(
      isErrorCode(value.error.code) ? value.error.code : ERROR_CODES.INTERNAL_UNEXPECTED,
      resolveMessage({ message: value.error.message }, fallbackMessage),
      value.error.traceId,
    );
  }

  if (isRecord(value) && 'response' in value) {
    const response = value.response as ApiResponse<unknown> | undefined;

    if (response && isFailure(response)) {
      return createTransportError(
        response.error.code,
        resolveMessage({ message: response.error.message }, fallbackMessage),
        response.error.traceId,
      );
    }
  }

  if (value instanceof Error) {
    return createTransportError(
      ERROR_CODES.INTERNAL_UNEXPECTED,
      resolveMessage(value, fallbackMessage),
      undefined,
      {
        name: value.name,
      },
    );
  }

  return createTransportError(
    ERROR_CODES.INTERNAL_UNEXPECTED,
    resolveMessage(value, fallbackMessage),
  );
}
