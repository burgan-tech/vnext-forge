import { describe, expect, it } from 'vitest';

import { buildComponentFolderRelPaths, matchVnextDomainComponentFolder } from './componentFolderPathUtils.js';
import type { VnextWorkspacePaths } from '@vnext-forge-studio/app-contracts';

const mockPaths: VnextWorkspacePaths = {
  componentsRoot: 'openbanking',
  workflows: 'Workflows',
  tasks: 'Tasks',
  schemas: 'Schemas',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
} as VnextWorkspacePaths;

describe('matchVnextDomainComponentFolder', () => {
  const rel = buildComponentFolderRelPaths(mockPaths);
  const projectRoot = '/p';

  it('returns kind for direct child of Extensions (domain folder)', () => {
    const node = '/p/openbanking/Extensions/account-opening';
    const r = matchVnextDomainComponentFolder(node, projectRoot, rel);
    expect(r?.componentKind).toBe('extension');
  });

  it('returns null for nested path under domain (e.g. src)', () => {
    const node = '/p/openbanking/Extensions/account-opening/src';
    expect(matchVnextDomainComponentFolder(node, projectRoot, rel)).toBeNull();
  });

  it('returns null for component type root', () => {
    const node = '/p/openbanking/Extensions';
    expect(matchVnextDomainComponentFolder(node, projectRoot, rel)).toBeNull();
  });
});
