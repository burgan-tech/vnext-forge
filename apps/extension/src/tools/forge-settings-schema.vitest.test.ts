import { describe, expect, it } from 'vitest';

import { parseEnvironments, sanitizeEnvironmentsForSharing } from './forge-settings-schema.js';

const localBinding = {
  domain: 'core',
  portOffset: 10,
  runtimePath: '/ws/.vnext-runtime',
  workspacePath: '/ws',
  ports: { app: 4211, execution: 4212, inbox: 4213, outbox: 4214, init: 3015 },
};

describe('parseEnvironments — domain', () => {
  it('keeps a trimmed domain on remote entries and drops empty ones', () => {
    const parsed = parseEnvironments({
      environments: [
        { id: 'a', name: 'Staging', baseUrl: 'http://localhost:4201/', domain: '  partner ' },
        { id: 'b', name: 'NoDomain', baseUrl: 'http://localhost:4202', domain: '   ' },
        { id: 'c', name: 'Legacy', baseUrl: 'http://localhost:4203' },
      ],
      activeEnvironmentId: 'a',
    });
    expect(parsed.environments.map((e) => e.domain)).toEqual(['partner', undefined, undefined]);
    expect(parsed.environments[0].baseUrl).toBe('http://localhost:4201');
  });
});

describe('sanitizeEnvironmentsForSharing — domain', () => {
  it('keeps the remote domain and carries a managed runtime domain onto the downgraded entry', () => {
    const shared = sanitizeEnvironmentsForSharing({
      version: 1,
      activeEnvironmentId: 'a',
      environments: [
        { id: 'a', name: 'Staging', baseUrl: 'http://s', kind: 'remote', domain: 'partner', dbName: 'vNext_partner' },
        { id: 'b', name: 'Local', baseUrl: 'http://localhost:4211', kind: 'local-docker', local: localBinding },
        { id: 'c', name: 'Plain', baseUrl: 'http://p' },
      ],
    });
    expect(shared.activeEnvironmentId).toBeNull();
    expect(shared.environments[0]).toEqual({
      id: 'a',
      name: 'Staging',
      baseUrl: 'http://s',
      dbName: 'vNext_partner',
      domain: 'partner',
      kind: 'remote',
    });
    expect(shared.environments[1]).toEqual({
      id: 'b',
      name: 'Local',
      baseUrl: 'http://localhost:4211',
      domain: 'core',
      kind: 'remote',
    });
    expect(shared.environments[2]).toEqual({ id: 'c', name: 'Plain', baseUrl: 'http://p' });
  });
});
