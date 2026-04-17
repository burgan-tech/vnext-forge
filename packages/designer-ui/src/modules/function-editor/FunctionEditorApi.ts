import { failureFromError, success, type ApiResponse } from '@vnext-forge/app-contracts';
import { readFile } from '../../modules/project-workspace/WorkspaceApi';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';
import { functionEditorDocumentSchema } from './FunctionEditorSchema';

interface LoadFunctionEditorParams {
  filePath: string;
}

export interface LoadFunctionEditorResult {
  filePath: string;
  json: Record<string, unknown>;
}

export async function loadFunctionEditor({
  filePath,
}: LoadFunctionEditorParams): Promise<ApiResponse<LoadFunctionEditorResult>> {
  try {
    const data = await readFile(filePath);
    const parsedContent =
      typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    const json = functionEditorDocumentSchema.parse(parsedContent);

    return success({
      filePath,
      json,
    });
  } catch (value) {
    return failureFromError(toVnextError(value));
  }
}
