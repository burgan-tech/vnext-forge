import { describe, expect, it } from 'vitest';

import {
  BUNDLE_VERSION,
  buildBundle,
  bucketsIn,
  collectSecretHeaderNames,
  looksSecret,
  parseBundle,
  stripHeaderValues,
  summarizeImport,
  type BundleSources,
} from './forge-config-bundle.js';

const SOURCES: BundleSources = {
  quickRun: {
    globalHeaders: [
      { name: 'Authorization', value: 'Bearer abc', isSecret: true },
      { name: 'X-Tenant', value: 'acme' },
    ],
    polling: { retryCount: 15, intervalMs: 4000 },
  },
  environments: {
    version: 1,
    activeEnvironmentId: 'env-1',
    environments: [
      { id: 'env-1', name: 'Local', baseUrl: 'http://localhost:4201' },
      {
        id: 'env-2',
        name: 'Docker',
        baseUrl: 'http://localhost:5301',
        kind: 'local-docker',
        local: {
          domain: 'core',
          portOffset: 100,
          runtimePath: '/Users/someone/repo/.vnext-runtime',
          workspacePath: '/Users/someone/repo',
          ports: { app: 1, execution: 2, inbox: 3, outbox: 4, init: 5 },
        },
      },
    ],
  },
  tenantStyle: { enabled: true, sourceType: 'url', value: 'https://cdn.example/tenant.css' },
  dataBuckets: [
    {
      domain: 'core',
      workflowKey: 'onboarding',
      config: {
        key: 'onboarding',
        globalHeaders: {},
        start: { headers: {}, queryStrings: {}, body: { attributes: {} } },
        transitions: [],
      },
    },
  ],
};

const OPTIONS = { includeSecretValues: true, now: '2026-08-07T00:00:00.000Z' };

describe('buildBundle', () => {
  it('includes only the selected buckets', () => {
    const bundle = buildBundle(['quickRun'], SOURCES, OPTIONS);
    expect(bucketsIn(bundle)).toEqual(['quickRun']);
    expect(bundle.environments).toBeUndefined();
  });

  it('blanks header values when secrets are excluded, keeping the names', () => {
    // The point of "names only": a teammate gets the shape of the config and
    // supplies their own token.
    const bundle = buildBundle(['quickRun'], SOURCES, { ...OPTIONS, includeSecretValues: false });
    expect(bundle.quickRun?.globalHeaders.map((h) => h.name)).toEqual(['Authorization', 'X-Tenant']);
    expect(bundle.quickRun?.globalHeaders.every((h) => h.value === '')).toBe(true);
  });

  it('never exports this machine s container binding or active environment', () => {
    // `local.runtimePath` is an absolute path on the exporter's disk, and
    // `activeEnvironmentId` is a personal pointer — neither means anything on
    // the machine importing it.
    const bundle = buildBundle(['environments'], SOURCES, OPTIONS);
    expect(bundle.environments?.activeEnvironmentId).toBeNull();
    const docker = bundle.environments?.environments.find((e) => e.id === 'env-2');
    expect(docker?.kind).toBe('remote');
    expect(docker).not.toHaveProperty('local');
    // The URL survives, so the entry stays usable.
    expect(docker?.baseUrl).toBe('http://localhost:5301');
  });

  it('round-trips through parseBundle', () => {
    const bundle = buildBundle(['quickRun', 'environments', 'tenantStyle', 'dataBuckets'], SOURCES, OPTIONS);
    const parsed = parseBundle(JSON.parse(JSON.stringify(bundle)));
    expect(parsed.error).toBeNull();
    expect(bucketsIn(parsed.bundle!)).toEqual(['quickRun', 'environments', 'tenantStyle', 'dataBuckets']);
    // Names and values survive exactly; `isSecret` comes back explicitly false
    // where it was absent, because `parseQuickRunSettings` normalizes it — the
    // same normalization every file read on disk already gets.
    expect(parsed.bundle?.quickRun?.globalHeaders).toEqual([
      { name: 'Authorization', value: 'Bearer abc', isSecret: true },
      { name: 'X-Tenant', value: 'acme', isSecret: false },
    ]);
    expect(parsed.bundle?.tenantStyle).toEqual(SOURCES.tenantStyle);
    expect(parsed.bundle?.dataBuckets?.[0]?.workflowKey).toBe('onboarding');
  });
});

describe('parseBundle', () => {
  it('refuses a bundle from a newer Forge rather than importing part of it', () => {
    const parsed = parseBundle({ version: BUNDLE_VERSION + 1, quickRun: {} });
    expect(parsed.bundle).toBeNull();
    expect(parsed.error).toMatch(/newer version/i);
  });

  it('rejects a file that is not a bundle', () => {
    expect(parseBundle(null).error).toBeTruthy();
    expect(parseBundle([]).error).toBeTruthy();
    expect(parseBundle({ quickRun: {} }).error).toMatch(/version/i);
  });

  it('rejects a well-formed bundle that carries nothing importable', () => {
    expect(parseBundle({ version: 1 }).error).toMatch(/no importable/i);
  });

  it('drops a corrupt bucket while its siblings still import', () => {
    const parsed = parseBundle({
      version: 1,
      quickRun: { globalHeaders: [{ name: 'X-Tenant', value: 'acme' }] },
      dataBuckets: 'not-a-list',
    });
    expect(parsed.error).toBeNull();
    expect(bucketsIn(parsed.bundle!)).toEqual(['quickRun']);
    expect(parsed.warnings.join(' ')).toMatch(/test data/i);
  });

  it('skips an unreadable data bucket entry and warns, keeping the good ones', () => {
    const parsed = parseBundle({
      version: 1,
      dataBuckets: [
        { domain: 'core', workflowKey: 'ok', config: { key: 'ok' } },
        { domain: 'core' },
      ],
    });
    expect(parsed.bundle?.dataBuckets).toHaveLength(1);
    expect(parsed.warnings).toHaveLength(1);
  });

  it('coerces junk inside a bucket instead of failing the whole import', () => {
    // Same coerce-and-drop behaviour the settings files get on disk — a
    // hand-edited bundle should import as much as it can.
    const parsed = parseBundle({
      version: 1,
      quickRun: { globalHeaders: [{ name: 'ok', value: 'v' }, { name: 42 }], polling: { retryCount: -1 } },
    });
    expect(parsed.bundle?.quickRun?.globalHeaders).toEqual([
      { name: 'ok', value: 'v', isSecret: false },
    ]);
    expect(parsed.bundle?.quickRun?.polling.retryCount).toBe(15);
  });
});

describe('summarizeImport', () => {
  it('describes only the buckets the bundle carries', () => {
    const bundle = buildBundle(['quickRun'], SOURCES, OPTIONS);
    const changes = summarizeImport(bundle, SOURCES);
    expect(changes.map((c) => c.bucket)).toEqual(['quickRun']);
  });

  it('states incoming and replaced counts, since import replaces rather than merges', () => {
    const bundle = buildBundle(['environments'], SOURCES, OPTIONS);
    const [change] = summarizeImport(bundle, SOURCES);
    expect(change?.summary).toContain('2');
    expect(change?.summary).toMatch(/replacing 2/);
  });
});

describe('secret detection', () => {
  it('flags credential-shaped header names', () => {
    for (const name of ['Authorization', 'x-api-key', 'API_KEY', 'Set-Cookie', 'my-token', 'Password']) {
      expect(looksSecret(name)).toBe(true);
    }
  });

  it('does not flag ordinary headers', () => {
    for (const name of ['X-Tenant', 'Accept-Language', 'X-Trace-Id']) {
      expect(looksSecret(name)).toBe(false);
    }
  });

  it('reports a header carrying a value, by flag or by name', () => {
    expect(
      collectSecretHeaderNames([
        { name: 'Authorization', value: 'Bearer x' },
        { name: 'X-Custom', value: 'y', isSecret: true },
        { name: 'X-Tenant', value: 'acme' },
      ]),
    ).toEqual(['Authorization', 'X-Custom']);
  });

  it('ignores a sensitive-looking header with no value — there is nothing to leak', () => {
    expect(collectSecretHeaderNames([{ name: 'Authorization', value: '' }])).toEqual([]);
    expect(collectSecretHeaderNames(undefined)).toEqual([]);
  });

  it('stripHeaderValues keeps names and flags', () => {
    expect(stripHeaderValues(SOURCES.quickRun.globalHeaders)).toEqual([
      { name: 'Authorization', value: '', isSecret: true },
      { name: 'X-Tenant', value: '' },
    ]);
  });
});
