import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runCsxSync } from './CsxSyncRunner.js';
import { isSyncedSourceFile, walkMappingTriples } from './jsonMappingWalker.js';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('walkMappingTriples', () => {
  it('finds .csx scripts and .md agent instructions, nothing else', () => {
    const hits = walkMappingTriples({
      attributes: {
        instructions: { location: './instructions.md', code: 'eA==', encoding: 'B64' },
        tools: [{ binding: { mapping: { location: './Tool.csx', code: '' } } }],
        notes: { location: './notes.txt', code: 'x' },
      },
    });
    expect(hits.map((h) => h.location)).toEqual(['./instructions.md', './Tool.csx']);
    expect(isSyncedSourceFile('/a/b/instructions.md')).toBe(true);
    expect(isSyncedSourceFile('/a/b/Tool.csx')).toBe(true);
    expect(isSyncedSourceFile('/a/b/data.json')).toBe(false);
  });
});

describe('runCsxSync with agent instructions', () => {
  it('re-inlines an edited instructions .md into the agent JSON', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forge-md-sync-'));
    dirs.push(root);
    const agentDir = join(root, 'core', 'Agents');
    await mkdir(agentDir, { recursive: true });
    const agentPath = join(agentDir, 'triage.json');
    const mdPath = join(agentDir, 'instructions.md');
    const agent = {
      key: 'triage',
      attributes: {
        provider: 'local',
        instructions: { location: './instructions.md', code: Buffer.from('old', 'utf8').toString('base64'), encoding: 'B64' },
      },
    };
    await writeFile(agentPath, JSON.stringify(agent, null, 2));
    await writeFile(mdPath, 'You triage requests.\n');

    const result = await runCsxSync(mdPath, root, { paths: { componentsRoot: 'core' } } as never, {
      defaultEncoding: 'B64',
      listComponentJsonPaths: () => Promise.resolve([agentPath]),
    });

    expect(result.updated).toBe(1);
    const saved = JSON.parse(await readFile(agentPath, 'utf8')) as typeof agent;
    expect(Buffer.from(saved.attributes.instructions.code, 'base64').toString('utf8')).toBe('You triage requests.\n');
    expect(saved.attributes.instructions.encoding).toBe('B64');
  });
});
