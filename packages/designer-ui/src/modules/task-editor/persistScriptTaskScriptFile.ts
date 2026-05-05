import { isFailure, success, type ApiResponse } from '@vnext-forge/app-contracts';

import { decodeScriptCode } from '../code-editor/editor/ScriptCodec.js';
import { readOptionalFile, writeFile } from '../project-workspace/WorkspaceApi.js';
import { resolveTaskScriptAbsolutePath } from './scriptTaskPaths.js';

const SCRIPT_TASK_TYPE = '5';

/**
 * For script tasks (type 5), writes base64 script body from `config` to disk.
 * Call before persisting task JSON.
 */
export async function persistScriptTaskScriptFile(
  taskJsonPath: string,
  componentJson: Record<string, unknown>,
): Promise<ApiResponse<{ created: boolean; skipped: boolean }>> {
  const attrs = componentJson.attributes as Record<string, unknown> | undefined;
  if (!attrs || String(attrs.type) !== SCRIPT_TASK_TYPE) {
    return success({ created: false, skipped: true });
  }

  const config = (attrs.config || {}) as Record<string, unknown>;
  const location = typeof config.location === 'string' ? config.location.trim() : '';
  const scriptRaw = config.script;
  if (!location || typeof scriptRaw !== 'string' || !scriptRaw) {
    return success({ created: false, skipped: true });
  }

  const resolved = resolveTaskScriptAbsolutePath(taskJsonPath, location);
  const source = decodeScriptCode(scriptRaw, config.encoding as string | undefined);

  const prior = await readOptionalFile(resolved);
  const created = prior === null;

  const writeRes = await writeFile(resolved, source);
  if (isFailure(writeRes)) return writeRes;

  return success({ created, skipped: false });
}
