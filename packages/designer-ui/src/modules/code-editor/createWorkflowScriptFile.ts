import { isFailure, type ApiResponse } from '@vnext-forge-studio/app-contracts';

import { getScriptLocationError } from './ScriptLocationValidation.js';

export type CreateWorkflowScriptFileStatus =
  | 'created'
  | 'exists'
  | 'invalid-location'
  | 'write-failed';

export interface CreateWorkflowScriptFileResult {
  status: CreateWorkflowScriptFileStatus;
  path: string | null;
  errorMessage?: string;
}

interface CreateWorkflowScriptFileOptions {
  workflowDirectoryPath: string;
  location: string;
  content: string;
  readOptionalFile: (path: string) => Promise<{ content: string } | null>;
  writeFile: (path: string, content: string) => Promise<ApiResponse<void>>;
}

interface CreateWorkflowScriptFileActionOptions {
  isTaskInline: boolean;
  workflowDirectoryPath?: string;
  encoding: string;
  location: string;
}

export function canShowCreateWorkflowScriptFileAction({
  isTaskInline,
  workflowDirectoryPath,
  encoding,
  location,
}: CreateWorkflowScriptFileActionOptions): boolean {
  return (
    !isTaskInline &&
    Boolean(workflowDirectoryPath) &&
    encoding !== 'NAT' &&
    Boolean(location.trim()) &&
    !getScriptLocationError(location)
  );
}

export function resolveWorkflowScriptAbsolutePath(workflowDir: string, location: string): string {
  const trimmed = location.trim();
  const relativePath = trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;
  const root = workflowDir
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
  return `${root}/${relativePath}`.replace(/\/{2,}/g, '/');
}

export async function createWorkflowScriptFile({
  workflowDirectoryPath,
  location,
  content,
  readOptionalFile,
  writeFile,
}: CreateWorkflowScriptFileOptions): Promise<CreateWorkflowScriptFileResult> {
  const trimmedLocation = location.trim();
  if (getScriptLocationError(trimmedLocation)) {
    return { status: 'invalid-location', path: null };
  }

  const path = resolveWorkflowScriptAbsolutePath(workflowDirectoryPath, trimmedLocation);
  const existing = await readOptionalFile(path);
  if (existing !== null) {
    return { status: 'exists', path };
  }

  const writeResult = await writeFile(path, content);
  if (isFailure(writeResult)) {
    return {
      status: 'write-failed',
      path,
      errorMessage: writeResult.error.message,
    };
  }

  return { status: 'created', path };
}
