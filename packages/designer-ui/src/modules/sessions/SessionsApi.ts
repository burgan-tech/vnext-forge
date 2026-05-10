import { unwrapApi } from '../../api/client.js';

import type { WorkspaceSession } from './SessionTypes.js';

/**
 * Thin wrappers over the `sessions/*` method registry endpoints. `get`
 * resolves with `null` when no session has been saved yet — callers should
 * apply defaults rather than treating that as an error.
 */

export async function getSession(projectId: string): Promise<WorkspaceSession | null> {
  const result = await unwrapApi<{ session: WorkspaceSession | null }>({
    method: 'sessions/get',
    params: { projectId },
  });
  return result.session;
}

export async function saveSession(
  projectId: string,
  session: WorkspaceSession,
): Promise<{ ok: true; path: string }> {
  return unwrapApi<{ ok: true; path: string }>({
    method: 'sessions/save',
    params: { projectId, session },
  });
}

export async function clearSession(projectId: string): Promise<{ cleared: boolean }> {
  return unwrapApi<{ cleared: boolean }>({
    method: 'sessions/clear',
    params: { projectId },
  });
}
