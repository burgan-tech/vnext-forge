import type { ErrorCode } from '@error/error-codes.js';

export const DEFAULT_USER_MESSAGE =
  'An unexpected error occurred. Please try again or contact support.';

/**
 * Safe, non-technical messages shown to end users.
 * Keyed by ErrorCode — add a message for every code that can surface in the UI.
 */
export const USER_MESSAGES: Partial<Record<ErrorCode, string>> = {
  // File
  FILE_NOT_FOUND: 'The requested file could not be found.',
  FILE_READ_ERROR: 'Failed to read the file. It may be corrupted or inaccessible.',
  FILE_WRITE_ERROR: 'Failed to save the file. Please check your permissions.',
  FILE_DELETE_ERROR: 'Failed to delete the file.',
  FILE_ALREADY_EXISTS: 'A file with this name already exists.',
  FILE_INVALID_PATH: 'The specified file path is invalid.',
  FILE_PERMISSION_DENIED: 'You do not have permission to access this file.',

  // Project
  PROJECT_NOT_FOUND: 'Project not found.',
  PROJECT_ALREADY_EXISTS: 'A project with this name already exists.',
  PROJECT_INVALID_CONFIG: 'The project configuration is invalid.',
  PROJECT_LOAD_ERROR: 'Failed to load the project.',
  PROJECT_SAVE_ERROR: 'Failed to save the project.',

  // Workflow
  WORKFLOW_NOT_FOUND: 'Workflow not found.',
  WORKFLOW_INVALID: 'The workflow definition is invalid.',
  WORKFLOW_PARSE_ERROR: 'Failed to parse the workflow file.',
  WORKFLOW_SAVE_ERROR: 'Failed to save the workflow.',
  WORKFLOW_VERSION_MISMATCH: 'This workflow was created with an incompatible version.',
  WORKFLOW_DUPLICATE_STATE: 'The workflow contains duplicate state IDs.',
  WORKFLOW_MISSING_INITIAL_STATE: 'The workflow is missing an initial state.',
  WORKFLOW_UNREACHABLE_STATE: 'The workflow contains unreachable states.',
  WORKFLOW_CYCLE_DETECTED: 'The workflow contains an invalid cycle.',
  WORKFLOW_INVALID_TRANSITION: 'The workflow contains an invalid transition.',

  // Runtime
  RUNTIME_NOT_AVAILABLE: 'The workflow runtime is not available.',
  RUNTIME_CONNECTION_FAILED: 'Could not connect to the runtime. Please check your settings.',
  RUNTIME_EXECUTION_FAILED: 'Workflow execution failed.',
  RUNTIME_TIMEOUT: 'The operation timed out.',
  RUNTIME_INVALID_RESPONSE: 'Received an unexpected response from the runtime.',

  // Simulation
  SIMULATION_INVALID_INPUT: 'The simulation input data is invalid.',
  SIMULATION_STATE_NOT_FOUND: 'The target state could not be found during simulation.',
  SIMULATION_NO_MATCHING_TRANSITION: 'No matching transition found for the current input.',
  SIMULATION_MAX_STEPS_EXCEEDED: 'The simulation exceeded the maximum number of steps.',

  // Git
  GIT_NOT_INITIALIZED: 'This project does not have a Git repository.',
  GIT_COMMIT_FAILED: 'Failed to commit changes.',
  GIT_PUSH_FAILED: 'Failed to push changes.',
  GIT_CONFLICT: 'There are conflicting changes that need to be resolved.',
  GIT_INVALID_REF: 'The specified Git reference is invalid.',

  // API
  API_BAD_REQUEST: 'The request could not be processed due to invalid input.',
  API_UNAUTHORIZED: 'You must be logged in to perform this action.',
  API_FORBIDDEN: 'You do not have permission to perform this action.',
  API_NOT_FOUND: 'The requested resource could not be found.',
  API_CONFLICT: 'This operation conflicts with the current state.',
  API_UNPROCESSABLE: 'The provided data could not be processed.',
  API_RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  API_INTERNAL_ERROR: 'A server error occurred. Please try again.',

  // Internal
  INTERNAL_UNEXPECTED: DEFAULT_USER_MESSAGE,
  INTERNAL_NOT_IMPLEMENTED: 'This feature is not yet available.',
  INTERNAL_ASSERTION_FAILED: DEFAULT_USER_MESSAGE,
};
