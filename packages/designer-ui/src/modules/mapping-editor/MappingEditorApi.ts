import { failureFromError, success, type ApiResponse } from '@vnext-forge-studio/app-contracts';
import { readFile } from '../../modules/project-workspace/WorkspaceApi';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';
import { mappingEditorDocumentSchema } from './MappingEditorSchema';

interface LoadMappingEditorParams {
  filePath: string;
}

export interface LoadMappingEditorResult {
  filePath: string;
  json: Record<string, unknown>;
}

export async function loadMappingEditor({
  filePath,
}: LoadMappingEditorParams): Promise<ApiResponse<LoadMappingEditorResult>> {
  try {
    const data = await readFile(filePath);
    const parsedContent =
      typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    const json = mappingEditorDocumentSchema.parse(parsedContent);
    return success({ filePath, json });
  } catch (value) {
    return failureFromError(toVnextError(value));
  }
}
