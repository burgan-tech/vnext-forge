import { callApi } from '@shared/api/client';

import { v1 } from './v1';

export async function checkCliAvailable() {
  return callApi<{ available: boolean; version?: string }>(
    v1.cli.check.$post({ json: {} }),
  );
}

export async function executeCliCommand(params: {
  command: string;
  projectId: string;
  filePath?: string;
  timeoutMs?: number;
}) {
  return callApi<{ exitCode: number; stdout: string; stderr: string }>(
    v1.cli.execute.$post({ json: params }),
  );
}

export async function checkCliUpdate() {
  return callApi<{ installed: string | null; latest: string | null; updateAvailable: boolean }>(
    v1.cli.checkUpdate.$post({ json: {} }),
  );
}

export async function updateCliGlobal() {
  return callApi<{ exitCode: number; stdout: string; stderr: string }>(
    v1.cli.updateGlobal.$post({ json: {} }),
  );
}
