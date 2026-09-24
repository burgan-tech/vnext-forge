import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { describe, expect, it } from 'vitest';

import { loadWorkflowMasterSchema, type MasterSchemaLoaderDeps } from './workflowMasterSchema';

const SCHEMA = { type: 'object', properties: { amount: { type: 'number', 'x-filterOperators': ['gte'] } } };

function deps(files: Record<string, string>, schemas: DiscoveredVnextComponent[]): MasterSchemaLoaderDeps {
  return {
    resolveWorkflowFile: (key) => Promise.resolve(key === 'mt' ? { path: '/p/Workflows/mt.json', projectId: 'core' } : null),
    readText: (path) => {
      const content = files[path];
      return content === undefined ? Promise.reject(new Error('missing')) : Promise.resolve(content);
    },
    listSchemas: () => Promise.resolve(schemas),
  };
}

const WORKFLOW = JSON.stringify({
  key: 'mt',
  attributes: { schema: { key: 'mt-master', domain: 'core', flow: 'sys-schemas', version: '1.0.0' } },
});
const MASTER = JSON.stringify({ key: 'mt-master', attributes: { type: 'master', schema: SCHEMA } });
const LISTED: DiscoveredVnextComponent[] = [
  { key: 'mt-master', path: '/p/Schemas/mt-master.json', flow: 'sys-schemas', domain: 'core' },
];

describe('loadWorkflowMasterSchema', () => {
  it('returns the fields of the workflow master schema', async () => {
    const load = await loadWorkflowMasterSchema(
      'mt',
      deps({ '/p/Workflows/mt.json': WORKFLOW, '/p/Schemas/mt-master.json': MASTER }, LISTED),
    );
    expect(load).toEqual({
      status: 'ready',
      schemaKey: 'mt-master',
      fields: [{ path: 'amount', type: 'number', indexed: false, filterOperators: ['gte'], sortable: false }],
    });
  });

  it('reports none when the workflow has no master schema', async () => {
    const load = await loadWorkflowMasterSchema(
      'mt',
      deps({ '/p/Workflows/mt.json': JSON.stringify({ key: 'mt', attributes: {} }) }, LISTED),
    );
    expect(load).toEqual({ status: 'none' });
  });

  it('reports unavailable when the workflow or schema cannot be read', async () => {
    expect(await loadWorkflowMasterSchema('other', deps({}, LISTED))).toEqual({ status: 'unavailable' });
    expect(await loadWorkflowMasterSchema('mt', deps({ '/p/Workflows/mt.json': WORKFLOW }, []))).toEqual({
      status: 'unavailable',
    });
    expect(await loadWorkflowMasterSchema('mt', deps({ '/p/Workflows/mt.json': '{ broken' }, LISTED))).toEqual({
      status: 'unavailable',
    });
  });
});
