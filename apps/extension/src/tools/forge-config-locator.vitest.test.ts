import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ForgeConfigLocator, WORKSPACE_CONFIG_DIR } from './forge-config-locator.js';

let tmp: string;
let globalDir: string;
let workspaceRoot: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-locator-'));
  globalDir = path.join(tmp, 'globalStorage');
  workspaceRoot = path.join(tmp, 'repo');
  await fs.mkdir(globalDir, { recursive: true });
  await fs.mkdir(workspaceRoot, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const FILE = 'quickrun-settings.json';

function locator(root: string | null): ForgeConfigLocator {
  return new ForgeConfigLocator(globalDir, () => root);
}

async function writeWorkspaceFile(): Promise<string> {
  const dir = path.join(workspaceRoot, WORKSPACE_CONFIG_DIR);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, FILE);
  await fs.writeFile(file, '{}', 'utf-8');
  return file;
}

describe('ForgeConfigLocator — resolution', () => {
  it('reads machine-local when no folder is open', async () => {
    const resolved = await locator(null).resolveRead(FILE);
    expect(resolved.source).toBe('local');
    expect(resolved.path).toBe(path.join(globalDir, FILE));
  });

  it('reads machine-local when a folder is open but has no shared config', async () => {
    // The feature must ship inert: a developer who never opts in sees exactly
    // today's behaviour.
    const resolved = await locator(workspaceRoot).resolveRead(FILE);
    expect(resolved.source).toBe('local');
    expect(resolved.path).toBe(path.join(globalDir, FILE));
  });

  it('prefers the workspace copy once it exists', async () => {
    const file = await writeWorkspaceFile();
    const resolved = await locator(workspaceRoot).resolveRead(FILE);
    expect(resolved.source).toBe('workspace');
    expect(resolved.path).toBe(file);
  });

  it('picks up a workspace file that appears later, without rebuilding the locator', async () => {
    // A teammate's `git pull` creates the file mid-session; the getter is live
    // and existence is re-checked per call, so nothing is cached into staleness.
    const subject = locator(workspaceRoot);
    expect((await subject.resolveRead(FILE)).source).toBe('local');
    await writeWorkspaceFile();
    expect((await subject.resolveRead(FILE)).source).toBe('workspace');
  });

  it('follows the workspace root the getter currently reports', async () => {
    let root: string | null = null;
    const subject = new ForgeConfigLocator(globalDir, () => root);
    await writeWorkspaceFile();

    expect((await subject.resolveRead(FILE)).source).toBe('local');
    root = workspaceRoot;
    expect((await subject.resolveRead(FILE)).source).toBe('workspace');
  });
});

describe('ForgeConfigLocator — writes follow reads', () => {
  it('agrees with resolveRead in every state', async () => {
    // The invariant the whole "writes follow the active source" decision rests
    // on. If these ever diverge, a user edits a setting, the other file keeps
    // winning, and nothing explains why.
    for (const root of [null, workspaceRoot]) {
      const subject = locator(root);
      expect(await subject.resolveWrite(FILE)).toEqual(await subject.resolveRead(FILE));
    }

    await writeWorkspaceFile();
    const subject = locator(workspaceRoot);
    expect(await subject.resolveWrite(FILE)).toEqual(await subject.resolveRead(FILE));
  });

  it('does not create the workspace copy as a side effect of a save', async () => {
    // Adopting the workspace is an explicit action, never something that just
    // happens because a setting changed.
    const subject = locator(workspaceRoot);
    expect((await subject.resolveWrite(FILE)).source).toBe('local');
    await expect(fs.stat(path.join(workspaceRoot, WORKSPACE_CONFIG_DIR))).rejects.toThrow();
  });
});

describe('ForgeConfigLocator — ensureWorkspaceDir', () => {
  it('creates the shared folder', async () => {
    const dir = await locator(workspaceRoot).ensureWorkspaceDir();
    expect(dir).toBe(path.join(workspaceRoot, WORKSPACE_CONFIG_DIR));
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  it('states the problem instead of writing somewhere unasked when no folder is open', async () => {
    await expect(locator(null).ensureWorkspaceDir()).rejects.toThrow(/Open a folder/i);
  });

  it('lives under .vnextstudio, the existing team-shared convention', () => {
    expect(WORKSPACE_CONFIG_DIR.split(path.sep)[0]).toBe('.vnextstudio');
  });
});
