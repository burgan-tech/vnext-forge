import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import type { WorkspaceRootResolver } from '@vnext-forge/services-core';

/**
 * `WorkspaceRootResolver` for the standalone web server. Returns
 * `~/vnext-projects` (matching the legacy Hono BFF behaviour) and ensures the
 * directory exists.
 */
export function createNodeWorkspaceRootResolver(): WorkspaceRootResolver {
  return {
    async resolveProjectsRoot() {
      const root = path.join(homedir(), 'vnext-projects');
      await fs.mkdir(root, { recursive: true });
      return root;
    },
  };
}
