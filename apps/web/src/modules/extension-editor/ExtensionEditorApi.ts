import { readFile } from '@modules/project-workspace/WorkspaceApi';
import { toVnextError } from '@shared/lib/error/VnextErrorHelpers';

interface LoadExtensionEditorParams {
  filePath: string;
}

interface LoadExtensionEditorResult {
  filePath: string;
  json: Record<string, unknown>;
}

export async function loadExtensionEditor({
  filePath,
}: LoadExtensionEditorParams): Promise<LoadExtensionEditorResult> {
  try {
    const data = await readFile(filePath);
    const json = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;

    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error('Extension file must contain a JSON object.');
    }

    return {
      filePath,
      json,
    };
  } catch (value) {
    throw toVnextError(value, 'Extension could not be loaded.');
  }
}
