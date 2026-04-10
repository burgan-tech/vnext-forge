import { apiClient, callApi } from '@shared/api/Client';

export function writeCodeEditorFile(path: string, content: string) {
  return callApi<void>(
    apiClient.api.files.$put({
      json: { path, content },
    }),
  );
}
