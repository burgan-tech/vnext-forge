import type { ErrorCode } from '@error/error-codes.js';

export interface ResponseMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ResponseError {
  code: ErrorCode;
  message: string;
  traceId?: string;
}

export type ApiSuccess<T, M extends ResponseMeta = ResponseMeta> = {
  success: true;
  data: T;
  error: null;
  meta?: M;
};

export type ApiFailure = {
  success: false;
  data: null;
  error: ResponseError;
  meta?: never;
};

export type ApiResponse<T, M extends ResponseMeta = ResponseMeta> =
  | ApiSuccess<T, M>
  | ApiFailure;
