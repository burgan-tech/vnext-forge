import { failureFromError, success, type ApiResponse } from '@vnext-forge-studio/app-contracts';
import { readFile, readOptionalFile } from '../../modules/project-workspace/WorkspaceApi';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';
import { agentEditorDocumentSchema } from './AgentEditorSchema';
import { instructionsFileRef, sameInstructionsText } from './agentInstructionsFile';

interface LoadAgentEditorParams {
  filePath: string;
}

export interface LoadAgentEditorResult {
  filePath: string;
  json: Record<string, unknown>;
  /**
   * Set when `instructions.location` exists on disk and differs from the
   * inlined `code`: the file text, to re-encode into `code` on open.
   */
  instructionsFromFile?: { location: string; text: string };
}

export async function loadAgentEditor({
  filePath,
}: LoadAgentEditorParams): Promise<ApiResponse<LoadAgentEditorResult>> {
  try {
    const data = await readFile(filePath);
    const parsedContent: unknown =
      typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    const json = agentEditorDocumentSchema.parse(parsedContent);
    const ref = instructionsFileRef(json, filePath);
    if (ref) {
      const file = await readOptionalFile(ref.absolutePath).catch(() => null);
      const text = typeof file?.content === 'string' ? file.content : null;
      if (text !== null && !sameInstructionsText(text, ref.text)) {
        return success({ filePath, json, instructionsFromFile: { location: ref.location, text } });
      }
    }
    return success({ filePath, json });
  } catch (value) {
    return failureFromError(toVnextError(value));
  }
}
