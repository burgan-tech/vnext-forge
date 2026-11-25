/**
 * CacheAside source mapping adapter: `{ sourceMapping, sourceInput, sourceOutput }` on the task config
 * is edited as a `{ mapping, input, output }` binding. Untouched members (and the rest of the config)
 * save back unchanged and in place; the mode switches never leave both forms behind.
 */
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';

import {
  addSetEntry,
  bindingMappingContent,
  setBlockMember,
  setSetExpression,
  switchToDeclarative,
  switchToScript,
} from './declarativeMapping';
import { applyRenamedBinding, CACHE_ASIDE_SOURCE_MEMBERS, readRenamedBinding } from './renamedBinding';

const SCRIPT = { location: './src/Source.csx', code: 'cmV0dXJuIG51bGw7', encoding: 'B64' };

const declarativeConfig = () => ({
  key: { location: 'dynamicExpresso', code: '"c:" + data.id', encoding: 'NAT' },
  ttlInSeconds: 60,
  sourceTask: { key: 'src', domain: 'core', version: '1.0.0' },
  sourceInput: { set: { '$.url': 'task.url + "/" + urlEncode(data.id)' } },
  sourceOutput: { select: '$.body.customer', set: { '$.b': '2', '$.a': '1' } },
  bypassOnCacheError: false,
});

const edit = <T extends Record<string, unknown>>(config: T, updater: Parameters<typeof applyRenamedBinding>[2]) =>
  produce(config, (draft) => {
    applyRenamedBinding(draft as Record<string, unknown>, CACHE_ASIDE_SOURCE_MEMBERS, updater);
  });

describe('renamed binding adapter (CacheAside source mapping)', () => {
  it('reads the source members as a binding view', () => {
    const config = declarativeConfig();
    const view = readRenamedBinding(config, CACHE_ASIDE_SOURCE_MEMBERS);
    expect(view).toEqual({ input: config.sourceInput, output: config.sourceOutput });
    expect(bindingMappingContent(view)).toBe('declarative');
    expect(bindingMappingContent(readRenamedBinding({ sourceMapping: SCRIPT }, CACHE_ASIDE_SOURCE_MEMBERS))).toBe('script');
    expect(bindingMappingContent(readRenamedBinding({}, CACHE_ASIDE_SOURCE_MEMBERS))).toBe('empty');
  });

  it('a no-op update saves back byte for byte', () => {
    const config = declarativeConfig();
    const text = JSON.stringify(config, null, 2);
    const next = edit(config, () => undefined);
    expect(next).toBe(config);
    expect(JSON.stringify(next, null, 2)).toBe(text);
  });

  it('an expression edit changes only that value; set order and every other member stay', () => {
    const config = declarativeConfig();
    const next = edit(config, (b) => setSetExpression(b, 'output', '$.b', '3'));
    expect(next.sourceOutput.set).toEqual({ '$.b': '3', '$.a': '1' });
    expect(Object.keys(next.sourceOutput.set)).toEqual(['$.b', '$.a']);
    expect(Object.keys(next)).toEqual(Object.keys(config));
    expect(next.sourceInput).toBe(config.sourceInput);
    expect(next.key).toBe(config.key);
    expect(next.sourceTask).toBe(config.sourceTask);
  });

  it('adding a block writes it under the source name only', () => {
    const next = edit({ sourceTask: { key: 'src' } } as Record<string, unknown>, (b) => {
      setBlockMember(b, 'output', 'into', '$.cached');
      addSetEntry(b, 'input', '$.body.id');
    });
    expect(next).toHaveProperty('sourceOutput', { into: '$.cached' });
    expect(next).toHaveProperty('sourceInput');
    expect(next).not.toHaveProperty('output');
    expect(next).not.toHaveProperty('input');
    expect(next).not.toHaveProperty('sourceMapping');
  });

  it('switching to the script drops both blocks; switching back drops the script — never both', () => {
    const scripted = edit(declarativeConfig() as Record<string, unknown>, switchToScript);
    expect(scripted).not.toHaveProperty('sourceInput');
    expect(scripted).not.toHaveProperty('sourceOutput');
    expect(scripted).toHaveProperty('bypassOnCacheError', false);

    const both = { ...declarativeConfig(), sourceMapping: SCRIPT } as Record<string, unknown>;
    expect(bindingMappingContent(readRenamedBinding(both, CACHE_ASIDE_SOURCE_MEMBERS))).toBe('both');
    const declarative = edit(both, switchToDeclarative);
    expect(declarative).not.toHaveProperty('sourceMapping');
    expect(declarative).toHaveProperty('sourceInput');
  });
});
