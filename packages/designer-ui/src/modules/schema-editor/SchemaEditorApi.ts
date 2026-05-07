import { failureFromError, success, type ApiResponse } from '@vnext-forge-studio/app-contracts';
import { readFile, writeFile } from '../../modules/project-workspace/WorkspaceApi';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';
import { assertSchemaEditorDocument } from './SchemaEditorSchema';

interface LoadSchemaEditorParams {
  filePath: string;
}

interface SaveSchemaEditorParams {
  filePath: string;
  json: Record<string, unknown>;
}

export interface SchemaEditorDocument {
  filePath: string;
  json: Record<string, unknown>;
}

export async function loadSchemaEditor({
  filePath,
}: LoadSchemaEditorParams): Promise<ApiResponse<SchemaEditorDocument>> {
  try {
    const data = await readFile(filePath);
    const parsedContent =
      typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    const validatedDocument = assertSchemaEditorDocument(
      parsedContent,
      'SchemaEditorApi.loadSchemaEditor',
    );

    return success({
      filePath,
      json: validatedDocument,
    });
  } catch (value) {
    return failureFromError(toVnextError(value, 'Schema could not be loaded.'));
  }
}

export async function saveSchemaEditor({
  filePath,
  json,
}: SaveSchemaEditorParams): Promise<ApiResponse<void>> {
  try {
    const validatedDocument = assertSchemaEditorDocument(json, 'SchemaEditorApi.saveSchemaEditor');
    return await writeFile(filePath, JSON.stringify(validatedDocument, null, 2));
  } catch (value) {
    return failureFromError(toVnextError(value, 'Schema could not be saved.'));
  }
}
