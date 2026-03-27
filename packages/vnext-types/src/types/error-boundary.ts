export enum ErrorAction {
  Abort = 0,
  Retry = 1,
  Rollback = 2,
  Ignore = 3,
  Notify = 4,
  Log = 5,
}

export enum BackoffType {
  Fixed = 0,
  Exponential = 1,
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelay: string;
  backoffType: BackoffType;
  backoffMultiplier?: number;
  maxDelay?: string;
  useJitter?: boolean;
}

export interface ErrorHandler {
  action: ErrorAction;
  errorTypes?: string[];
  errorCodes?: string[];
  transition?: string;
  priority?: number;
  retryPolicy?: RetryPolicy;
  logOnly?: boolean;
}

export interface ErrorBoundary {
  onError: ErrorHandler[];
}
