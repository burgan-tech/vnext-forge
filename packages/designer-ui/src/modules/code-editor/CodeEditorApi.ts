import { callApi } from '../../api/client';
import { emitFsChangeOnSuccess } from '../../workspace-fs-events/index.js';

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

export function writeCodeEditorFile(path: string, content: string) {
  const normalized = normalizeFilePath(path);
  return emitFsChangeOnSuccess(
    callApi<void>({
      method: 'files/write',
      params: { path: normalized, content },
    }),
    () => ({ kind: 'write', paths: [normalized], source: 'CodeEditorApi.writeCodeEditorFile' }),
  );
}
