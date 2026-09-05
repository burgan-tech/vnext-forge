import { afterEach, describe, expect, it, vi } from 'vitest';

import { failure, success } from '@vnext-forge-studio/app-contracts';

import { setApiTransport } from '../../api/transport.js';
import type { ProjectInfo } from '../../shared/projectTypes.js';
import { resolveSiblingSolutionProject, resolveWorkflowRoute } from './resolveWorkflowFileByKey.js';

const active: ProjectInfo = { id: 'core', domain: 'core', path: '/ws', linked: true };

function transportFor(handlers: Record<string, (params: unknown) => unknown>) {
  return {
    send: vi.fn((method: string, params: unknown) => {
      const handler = handlers[method];
      return Promise.resolve(
        handler ? handler(params) : failure({ code: 'API_NOT_FOUND', message: `no ${method}`, traceId: 't' }),
      );
    }),
  };
}

describe('resolveSiblingSolutionProject', () => {
  afterEach(() => {
    setApiTransport(null);
  });

  it('returns the sibling project when it shares the active project root', async () => {
    setApiTransport(
      transportFor({
        'projects/getById': (params) => {
          const { id } = params as { id: string };
          return success({ id, domain: id, path: id === 'partner' ? '/ws/' : '/ws', linked: true });
        },
        'projects/getConfig': () =>
          success({ domain: 'partner', paths: { componentsRoot: 'partner', workflows: 'Workflows' } }),
      }) as never,
    );
    const sibling = await resolveSiblingSolutionProject('partner', active);
    expect(sibling).toEqual({
      id: 'partner',
      path: '/ws/',
      paths: { componentsRoot: 'partner', workflows: 'Workflows' },
    });
  });

  it('rejects a project registered under a different root', async () => {
    setApiTransport(
      transportFor({
        'projects/getById': (params) => {
          const { id } = params as { id: string };
          return success({ id, domain: id, path: id === 'partner' ? '/elsewhere' : '/ws', linked: true });
        },
      }) as never,
    );
    expect(await resolveSiblingSolutionProject('partner', active)).toBeNull();
  });

  it('returns null when the domain is not a registered project', async () => {
    setApiTransport(
      transportFor({
        'projects/getById': (params) => {
          const { id } = params as { id: string };
          if (id === 'core') return success({ id, domain: id, path: '/ws', linked: true });
          return failure({ code: 'PROJECT_NOT_FOUND', message: 'nope', traceId: 't' });
        },
      }) as never,
    );
    expect(await resolveSiblingSolutionProject('loans', active)).toBeNull();
  });
});

describe('resolveWorkflowRoute', () => {
  it('maps a sibling solution file onto its own componentsRoot', () => {
    expect(
      resolveWorkflowRoute('/ws/partner/Workflows/lab/xd-child.json', '/ws', {
        componentsRoot: 'partner',
        workflows: 'Workflows',
      }),
    ).toEqual({ group: 'lab', name: 'xd-child' });
    expect(
      resolveWorkflowRoute('/ws/partner/Workflows/lab/xd-child.json', '/ws', {
        componentsRoot: 'core',
        workflows: 'Workflows',
      }),
    ).toBeNull();
  });
});
