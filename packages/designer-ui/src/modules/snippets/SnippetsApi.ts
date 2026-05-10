import { unwrapApi } from '../../api/client.js';

import type {
  Snippet,
  SnippetFile,
  SnippetScope,
  SnippetsListAllResult,
  SnippetsSaveResult,
} from './SnippetTypes.js';

/**
 * Thin wrappers over the `snippets/*` method registry endpoints. Each returns
 * a Promise that resolves with the unwrapped data; failures throw a typed
 * `VnextForgeError` (handled by `unwrapApi`).
 *
 * `projectId` is passed through verbatim — when omitted, project-scope calls
 * fail server-side with `API_BAD_REQUEST` ("Project snippets require a
 * projectId."). Callers should gate on an active project before invoking
 * project-scope operations.
 */

export async function listAllSnippets(projectId?: string): Promise<SnippetsListAllResult> {
  return unwrapApi<SnippetsListAllResult>({
    method: 'snippets/listAll',
    params: projectId ? { projectId } : {},
  });
}

export async function getSnippet(
  scope: SnippetScope,
  id: string,
  projectId?: string,
): Promise<Snippet> {
  const result = await unwrapApi<{ snippet: Snippet }>({
    method: 'snippets/getOne',
    params: { scope, id, ...(projectId ? { projectId } : {}) },
  });
  return result.snippet;
}

export async function saveSnippet(
  scope: SnippetScope,
  data: SnippetFile,
  options: { id?: string; projectId?: string } = {},
): Promise<SnippetsSaveResult> {
  return unwrapApi<SnippetsSaveResult>({
    method: 'snippets/save',
    params: {
      scope,
      data,
      ...(options.id ? { id: options.id } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
    },
  });
}

export async function deleteSnippet(
  scope: SnippetScope,
  id: string,
  projectId?: string,
): Promise<{ deleted: boolean }> {
  return unwrapApi<{ deleted: boolean }>({
    method: 'snippets/delete',
    params: { scope, id, ...(projectId ? { projectId } : {}) },
  });
}

export async function openSnippetLocation(
  scope: SnippetScope,
  options: { id?: string; projectId?: string } = {},
): Promise<{ path: string }> {
  return unwrapApi<{ path: string }>({
    method: 'snippets/openLocation',
    params: {
      scope,
      ...(options.id ? { id: options.id } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
    },
  });
}
