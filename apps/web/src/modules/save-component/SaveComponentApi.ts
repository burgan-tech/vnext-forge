import { failureFromError, success, type ApiResponse } from '@vnext-forge/app-contracts';
import { z } from 'zod';
import { callApi, unwrapApi } from '@shared/api/client';
import { toVnextError } from '@shared/lib/error/vNextErrorHelpers';

export interface LoadComponentFileParams {
  filePath: string;
  errorMessage?: string;
  parse?: (content: unknown) => Record<string, unknown>;
}

export interface ComponentFileDocument {
  filePath: string;
  json: Record<string, unknown>;
}

const componentDocumentSchema = z.object({}).catchall(z.unknown());

function parseComponentObject(content: unknown): Record<string, unknown> {
  return componentDocumentSchema.parse(content);
}

export function saveComponentFile(path: string, content: string) {
  return callApi<void>({
    method: 'files.write',
    params: { path, content },
  });
}

export async function loadComponentFile({
  filePath,
  errorMessage = 'Component could not be loaded.',
  parse,
}: LoadComponentFileParams): Promise<ApiResponse<ComponentFileDocument>> {
  try {
    const data = await unwrapApi<{ content: string }>(
      { method: 'files.read', params: { path: filePath } },
      errorMessage,
    );
    const parsedContent =
      typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
    const json = parse ? parse(parsedContent) : parseComponentObject(parsedContent);

    return success({
      filePath,
      json,
    });
  } catch (value) {
    return failureFromError(toVnextError(value, errorMessage));
  }
}
