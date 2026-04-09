import type { WorkspaceBrowseResult } from './workspace-types';
import { apiClient, callApi, unwrapApi } from '@shared/api/client';

export function browseWorkspace(path?: string) {
  return callApi<WorkspaceBrowseResult>(
    apiClient.api.files.browse.$get({
      query: path ? { path } : {},
    }),
  );
}

export function readFile(path: string) {
  return unwrapApi<{ content: string }>(
    apiClient.api.files.$get({
      query: { path },
    }),
    'Failed to read file',
  );
}

export function writeFile(path: string, content: string) {
  return callApi<void>(
    apiClient.api.files.$put({
      json: { path, content },
    }),
  );
}

export function deleteFile(path: string) {
  return callApi<void>(
    apiClient.api.files.$delete({
      query: { path },
    }),
  );
}

export function createDirectory(path: string) {
  return callApi<void>(
    apiClient.api.files.mkdir.$post({
      json: { path },
    }),
  );
}

export function renameFile(oldPath: string, newPath: string) {
  return callApi<void>(
    apiClient.api.files.rename.$post({
      json: { oldPath, newPath },
    }),
  );
}
