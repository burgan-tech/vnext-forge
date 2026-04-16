import { apiClient, callApi } from '@shared/api/client';

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

export function writeCodeEditorFile(path: string, content: string) {
  return callApi<void>(
    apiClient.api.files.$put({
      json: { path: normalizeFilePath(path), content },
    }),
  );
}
