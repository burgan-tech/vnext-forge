import { callApi } from '../../api/client';

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

export function writeCodeEditorFile(path: string, content: string) {
  return callApi<void>({
    method: 'files/write',
    params: { path: normalizeFilePath(path), content },
  });
}
