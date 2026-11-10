import { failureFromError, success, type ApiResponse } from '@vnext-forge-studio/app-contracts';
import { readFile } from '../../modules/project-workspace/WorkspaceApi';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';
import { agentEditorDocumentSchema } from './AgentEditorSchema';

interface LoadAgentEditorParams {
  filePath: string;
}

export interface LoadAgentEditorResult {
  filePath: string;
  json: Record<string, unknown>;
}

export async function loadAgentEditor({
  filePath,
}: LoadAgentEditorParams): Promise<ApiResponse<LoadAgentEditorResult>> {
  try {
    const data = await readFile(filePath);
    const parsedContent: unknown =
      typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    const json = agentEditorDocumentSchema.parse(parsedContent);
    return success({ filePath, json });
  } catch (value) {
    return failureFromError(toVnextError(value));
  }
}
