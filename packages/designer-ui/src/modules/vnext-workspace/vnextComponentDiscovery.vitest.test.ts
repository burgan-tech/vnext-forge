import { describe, expect, it } from 'vitest';

import type { FileTreeNode } from '../../shared/projectTypes.js';
import type { ComponentFolderType } from '../component-icons/componentFolderTypes.js';
import {
  collectJsonCandidatesUnderPathRoots,
  flowToExportCategory,
  parseVnextComponentJson,
  VNEXT_FLOW_TO_EXPORT_CATEGORY,
} from './vnextComponentDiscovery.js';

describe('parseVnextComponentJson', () => {
  it('returns key, flow, and optional version for valid JSON', () => {
    expect(
      parseVnextComponentJson(
        JSON.stringify({
          key: 'my-task',
          flow: 'sys-tasks',
          domain: 'x',
          version: '1.0.0',
        }),
      ),
    ).toEqual({ key: 'my-task', flow: 'sys-tasks', version: '1.0.0' });
  });

  it('trims key and flow', () => {
    expect(
      parseVnextComponentJson(JSON.stringify({ key: '  k  ', flow: '  sys-flows  ' })),
    ).toEqual({ key: 'k', flow: 'sys-flows' });
  });

  it('returns null for invalid JSON', () => {
    expect(parseVnextComponentJson('{')).toBeNull();
  });

  it('returns null when key or flow missing or not string', () => {
    expect(parseVnextComponentJson(JSON.stringify({ flow: 'sys-tasks' }))).toBeNull();
    expect(parseVnextComponentJson(JSON.stringify({ key: 'a', flow: 1 }))).toBeNull();
    expect(parseVnextComponentJson(JSON.stringify([]))).toBeNull();
  });
});

describe('flowToExportCategory', () => {
  it('maps canonical sys-* flows', () => {
    expect(flowToExportCategory('sys-tasks')).toBe('tasks');
    expect(flowToExportCategory('sys-flows')).toBe('workflows');
    expect(flowToExportCategory('sys-schemas')).toBe('schemas');
    expect(flowToExportCategory('sys-views')).toBe('views');
    expect(flowToExportCategory('sys-functions')).toBe('functions');
    expect(flowToExportCategory('sys-extensions')).toBe('extensions');
  });

  it('returns null for unknown flow', () => {
    expect(flowToExportCategory('sys-workflows')).toBeNull();
  });

  it('VNEXT_FLOW_TO_EXPORT_CATEGORY covers six export buckets', () => {
    expect(Object.keys(VNEXT_FLOW_TO_EXPORT_CATEGORY)).toHaveLength(6);
  });
});

describe('collectJsonCandidatesUnderPathRoots', () => {
  const projectRoot = 'C:/proj';
  const relPaths: Partial<Record<ComponentFolderType, string>> = {
    components_root: 'openbanking',
    tasks: 'openbanking/Tasks',
    workflows: 'openbanking/Workflows',
    schemas: 'openbanking/Schemas',
    views: 'openbanking/Views',
    functions: 'openbanking/Functions',
    extensions: 'openbanking/Extensions',
  };

  const tree: FileTreeNode = {
    name: 'proj',
    path: projectRoot,
    type: 'directory',
    children: [
      {
        name: 'openbanking',
        path: `${projectRoot}/openbanking`,
        type: 'directory',
        children: [
          {
            name: 'Tasks',
            path: `${projectRoot}/openbanking/Tasks`,
            type: 'directory',
            children: [
              {
                name: 'g',
                path: `${projectRoot}/openbanking/Tasks/g`,
                type: 'directory',
                children: [
                  {
                    name: 't.json',
                    path: `${projectRoot}/openbanking/Tasks/g/t.json`,
                    type: 'file',
                  },
                ],
              },
            ],
          },
          {
            name: 'Other',
            path: `${projectRoot}/openbanking/Other`,
            type: 'directory',
            children: [
              {
                name: 'x.json',
                path: `${projectRoot}/openbanking/Other/x.json`,
                type: 'file',
              },
            ],
          },
        ],
      },
    ],
  };

  it('classifies json under tasks root as tasks', () => {
    const found = collectJsonCandidatesUnderPathRoots(tree, projectRoot, relPaths);
    expect(found).toEqual([
      { path: `${projectRoot}/openbanking/Tasks/g/t.json`, category: 'tasks' },
    ]);
  });

  it('matches path roots case-insensitively on Windows-style tree paths', () => {
    const lowerTree: FileTreeNode = {
      name: 'proj',
      path: 'c:/proj',
      type: 'directory',
      children: [
        {
          name: 'OpenBanking',
          path: 'c:/proj/OpenBanking',
          type: 'directory',
          children: [
            {
              name: 'tasks',
              path: 'c:/proj/OpenBanking/tasks',
              type: 'directory',
              children: [
                {
                  name: 'a.json',
                  path: 'c:/proj/OpenBanking/tasks/a.json',
                  type: 'file',
                },
              ],
            },
          ],
        },
      ],
    };
    const found = collectJsonCandidatesUnderPathRoots(lowerTree, 'C:/Proj', relPaths);
    expect(found).toHaveLength(1);
    expect(found[0]!.category).toBe('tasks');
  });
});
