export type {
  ApiResponse,
  ApiSuccess,
  ApiFailure,
  ResponseError,
  ResponseMeta,
} from './response/envelope.js';
export {
  ERROR_CODES,
  FILE_ERRORS,
  PROJECT_ERRORS,
  WORKFLOW_ERRORS,
  RUNTIME_ERRORS,
  SIMULATION_ERRORS,
  GIT_ERRORS,
  API_ERRORS,
  INTERNAL_ERRORS,
} from './error/error-codes.js';
export type { ErrorCode } from './error/error-codes.js';

export { VnextForgeError } from './error/vnext-forge-error.js';
export type {
  ErrorLayer,
  VnextForgeErrorContext,
  VnextForgeErrorLogEntry,
  VnextForgeErrorUserMessage,
} from './error/vnext-forge-error.js';

export {
  ERROR_PRESENTATION,
  getErrorPresentation,
} from './error/error-presentation.js';
export type {
  ErrorPresentation,
  ErrorRecoveryAction,
  ErrorSeverity,
} from './error/error-presentation.js';

export {
  success,
  failure,
  failureFromCode,
  failureFromError,
  internalFailure,
  isSuccess,
  isFailure,
  getData,
  getError,
  getMeta,
  unwrap,
  unwrapOr,
  mapResponse,
  fold,
} from './response/helpers.js';

export {
  LogLevelSchema,
  NodeEnvSchema,
  csvList,
  coercedBool,
  isLoopbackHost,
} from './env/common.js';
export type { LogLevel, NodeEnv } from './env/common.js';

export {
  VNEXT_WORKSPACE_RUNTIME_VERSION,
  VNEXT_WORKSPACE_SCHEMA_VERSION,
  VNEXT_WORKSPACE_CONFIG_VERSION,
  buildVnextWorkspaceConfig,
} from './vnext/vnext-workspace-defaults.js';
export type {
  BuildVnextWorkspaceConfigInput,
  VnextWorkspaceConfig,
  VnextWorkspaceDependencies,
  VnextWorkspaceExports,
  VnextWorkspaceExportsMeta,
  VnextWorkspacePaths,
  VnextWorkspaceReferenceResolution,
} from './vnext/vnext-workspace-defaults.js';
