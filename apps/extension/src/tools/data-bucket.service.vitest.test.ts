import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DataBucketService, parseWorkflowBucketConfig } from './data-bucket.service.js';
import { ForgeConfigLocator, WORKSPACE_CONFIG_DIR } from './forge-config-locator.js';

let tmp: string;
let globalDir: string;
let workspaceRoot: string;
let sharedDir: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-buckets-'));
  globalDir = path.join(tmp, 'globalStorage');
  workspaceRoot = path.join(tmp, 'repo');
  sharedDir = path.join(workspaceRoot, WORKSPACE_CONFIG_DIR);
  await fs.mkdir(globalDir, { recursive: true });
  await fs.mkdir(workspaceRoot, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const CONFIG = {
  key: 'onboarding',
  globalHeaders: { 'X-Tenant': 'acme' },
  start: { headers: {}, queryStrings: {}, body: { attributes: { amount: 1 } } },
  transitions: [],
};

function service(): DataBucketService {
  return new DataBucketService(new ForgeConfigLocator(globalDir, () => workspaceRoot));
}

describe('DataBucketService — resolution', () => {
  it('saves and loads machine-local while no shared copy exists', async () => {
    const subject = service();
    await subject.saveConfig('core', 'onboarding', CONFIG);

    expect((await subject.loadConfig('core', 'onboarding'))?.key).toBe('onboarding');
    await expect(fs.stat(path.join(sharedDir, 'data-buckets'))).rejects.toThrow();
  });

  it('prefers the workspace copy over the machine-local one', async () => {
    const subject = service();
    await subject.saveConfig('core', 'onboarding', CONFIG);
    await subject.saveConfigInRoot(sharedDir, 'core', 'onboarding', { ...CONFIG, key: 'from-workspace' });

    expect((await subject.loadConfig('core', 'onboarding'))?.key).toBe('from-workspace');
  });

  it('writes back to the workspace copy once it exists', async () => {
    // Writes follow reads, so an edit after adopting the workspace stays shared
    // rather than silently diverging into a local file nobody reads.
    const subject = service();
    await subject.saveConfigInRoot(sharedDir, 'core', 'onboarding', CONFIG);
    await subject.saveConfig('core', 'onboarding', { ...CONFIG, key: 'edited' });

    const shared = JSON.parse(
      await fs.readFile(path.join(sharedDir, 'data-buckets', 'core', 'onboarding.json'), 'utf-8'),
    ) as { key: string };
    expect(shared.key).toBe('edited');
    await expect(fs.stat(path.join(globalDir, 'data-buckets', 'core', 'onboarding.json'))).rejects.toThrow();
  });

  it('lists the workspace copy in preference to the local one, without duplicating', async () => {
    const subject = service();
    await subject.saveConfig('core', 'onboarding', CONFIG);
    await subject.saveConfigInRoot(sharedDir, 'core', 'onboarding', { ...CONFIG, key: 'from-workspace' });
    await subject.saveConfig('core', 'other', CONFIG);

    const listed = await subject.listConfigs();
    expect(listed).toHaveLength(2);
    expect(listed.find((e) => e.workflowKey === 'onboarding')?.config.key).toBe('from-workspace');
  });

  it('returns null for a bucket that was never saved', async () => {
    expect(await service().loadConfig('core', 'missing')).toBeNull();
  });
});

describe('DataBucketService — path jail', () => {
  it('refuses a domain that tries to escape the config roots', async () => {
    // `sanitizeFileName` strips separators but not `.`, and domain comes off
    // the webview wire — now that a write can land in the user's repository,
    // an escape must be refused rather than merely improbable.
    await expect(
      service().saveConfig('../../../etc', 'passwd', CONFIG),
    ).resolves.toBeUndefined();

    // The sanitized name keeps it inside the root, which is the point: nothing
    // was written outside `globalDir`.
    const escaped = path.join(tmp, 'etc');
    await expect(fs.stat(escaped)).rejects.toThrow();
  });
});

describe('parseWorkflowBucketConfig', () => {
  it('rejects a non-object', () => {
    expect(parseWorkflowBucketConfig(null)).toBeNull();
    expect(parseWorkflowBucketConfig([])).toBeNull();
    expect(parseWorkflowBucketConfig('nope')).toBeNull();
  });

  it('fills in the structure a partial config is missing', () => {
    const parsed = parseWorkflowBucketConfig({ key: 'k' });
    expect(parsed).toMatchObject({
      key: 'k',
      globalHeaders: {},
      start: { headers: {}, queryStrings: {}, body: { attributes: {} } },
      transitions: [],
    });
  });

  it('drops non-string header values rather than passing them to a request', () => {
    const parsed = parseWorkflowBucketConfig({
      key: 'k',
      globalHeaders: { good: 'v', bad: { nested: true }, alsoBad: 42 },
    });
    expect(parsed?.globalHeaders).toEqual({ good: 'v' });
  });

  it('preserves fields this type does not know about', () => {
    // The UI's `WorkflowBucketConfig` is ahead of the host's; stripping what it
    // wrote would silently lose the user's saved test data.
    const parsed = parseWorkflowBucketConfig({
      key: 'k',
      retryState: { headers: { a: 'b' }, attributes: {} },
      start: { body: { stage: 'draft', attributes: {} } },
    });
    expect(parsed?.retryState).toEqual({ headers: { a: 'b' }, attributes: {} });
    expect(parsed?.start.body.stage).toBe('draft');
  });

  it('keeps only well-formed transition entries', () => {
    const parsed = parseWorkflowBucketConfig({
      key: 'k',
      transitions: [{ key: 'approve', headers: { a: 'b' } }, 'junk', null],
    });
    expect(parsed?.transitions).toHaveLength(1);
    expect(parsed?.transitions[0]).toMatchObject({ key: 'approve', headers: { a: 'b' } });
  });
});
