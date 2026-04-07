import type { WorkspaceBrowseResult } from '@entities/workspace/model/types';
import { apiClient, callApi } from '@shared/api/client';

export function browseWorkspace(path?: string) {
  return callApi<WorkspaceBrowseResult>(
    apiClient.api.files.browse.$get({
      query: path ? { path } : {},
    }),
  );
}
