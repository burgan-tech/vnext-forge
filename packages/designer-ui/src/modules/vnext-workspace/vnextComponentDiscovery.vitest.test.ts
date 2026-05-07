import { describe, expect, it, afterEach, vi } from 'vitest';

import { success } from '@vnext-forge-studio/app-contracts';

import { setApiTransport } from '../../api/transport.js';
import {
  discoverAllVnextComponents,
  discoverVnextComponentsByCategory,
  flowToExportCategory,
  VNEXT_FLOW_TO_EXPORT_CATEGORY,
} from './vnextComponentDiscovery.js';

describe('vnextComponentDiscovery (RPC)', () => {
  afterEach(() => {
    setApiTransport(null);
  });

  it('discoverVnextComponentsByCategory calls vnext/<cat>/list with id', async () => {
    const transport = {
      send: vi.fn().mockResolvedValue(
        success([{ key: 'a', path: '/p', flow: 'sys-tasks' }]) as never,
      ),
    };
    setApiTransport(transport);

    const list = await discoverVnextComponentsByCategory('proj-1', 'tasks');
    expect(transport.send).toHaveBeenCalledWith('vnext/tasks/list', { id: 'proj-1' });
    expect(list).toHaveLength(1);
    expect(list[0]?.key).toBe('a');
  });

  it('discoverAllVnextComponents calls vnext/components/list with optional previewPaths JSON', async () => {
    const transport = {
      send: vi.fn().mockResolvedValue(
        success({
          components: {
            workflows: [],
            tasks: [],
            schemas: [],
            views: [],
            functions: [],
            extensions: [],
          },
        }) as never,
      ),
    };
    setApiTransport(transport);

    await discoverAllVnextComponents('p2', {
      previewPaths: {
        componentsRoot: 'core',
        tasks: 'Tasks',
        views: '',
        functions: '',
        extensions: '',
        workflows: '',
        schemas: '',
      },
    });
    expect(transport.send).toHaveBeenCalledWith('vnext/components/list', {
      id: 'p2',
      previewPaths: expect.stringContaining('"componentsRoot":"core"'),
    });
  });
});

describe('flowToExportCategory', () => {
  it('maps canonical sys-* flows', () => {
    expect(flowToExportCategory('sys-tasks')).toBe('tasks');
    expect(flowToExportCategory('sys-flows')).toBe('workflows');
  });

  it('VNEXT_FLOW_TO_EXPORT_CATEGORY covers six export buckets', () => {
    expect(Object.keys(VNEXT_FLOW_TO_EXPORT_CATEGORY)).toHaveLength(6);
  });
});
