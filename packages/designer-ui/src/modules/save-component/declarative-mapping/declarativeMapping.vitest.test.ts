import { describe, expect, it } from 'vitest';

import {
  addSetEntry,
  bindingMappingContent,
  isInputWritePath,
  isReadPath,
  isWritePath,
  moveSetEntry,
  pathSegment,
  removeSetEntry,
  renameSetKey,
  resolveMappingMode,
  setBlockMember,
  setSetExpression,
  switchToDeclarative,
  switchToScript,
  validateMappingBlock,
  type MappingBindingLike,
} from './declarativeMapping';

const TASK = { key: 'score-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' };
const SCRIPT = { location: './src/Score.csx', code: 'Y29kZQ==' };

describe('paths (runtime JsonPath subset)', () => {
  it.each(['$', '$.a', '$.a-b.c', "$['a b']", "$['it\\'s']", '$.items[0]', '$.items[*].id'])(
    'reads %s',
    (p) => {
      expect(isReadPath(p)).toBe(true);
    },
  );

  it.each(['a.b', '$..a', '$.a[?(@.x)]', '$.a[', "$['a]", '$.'])('rejects read path %s', (p) => {
    expect(isReadPath(p)).toBe(false);
  });

  it('writes named segments only — no root, index or wildcard', () => {
    expect(isWritePath('$.kyc.score')).toBe(true);
    expect(isWritePath("$['kyc']['score']")).toBe(true);
    expect(isWritePath('$')).toBe(false);
    expect(isWritePath('$.items[0]')).toBe(false);
    expect(isWritePath('$.items[*]')).toBe(false);
  });

  it('input targets are any field of the task config', () => {
    expect(isInputWritePath('$.url')).toBe(true);
    expect(isInputWritePath('$.body.customerId')).toBe(true);
    expect(isInputWritePath('$.headers.x-channel')).toBe(true);
    expect(isInputWritePath('$.timeoutSeconds')).toBe(true);
    expect(isInputWritePath("$['headers']['x-trace']")).toBe(true);
    expect(isInputWritePath('$')).toBe(false);
    expect(isInputWritePath('$.headers[0]')).toBe(false);
  });

  it('quotes names that cannot be a dot segment', () => {
    expect(pathSegment('customer')).toBe('.customer');
    expect(pathSegment('x-channel')).toBe('.x-channel');
    expect(pathSegment('first name')).toBe("['first name']");
    expect(pathSegment("it's")).toBe("['it\\'s']");
  });
});

describe('mode', () => {
  it('derives the mode from what the binding holds; empty takes the preference, declarative by default', () => {
    expect(resolveMappingMode({ task: TASK })).toBe('declarative');
    expect(resolveMappingMode({ task: TASK }, 'script')).toBe('script');
    expect(resolveMappingMode({ task: TASK, mapping: SCRIPT }, 'declarative')).toBe('script');
    expect(resolveMappingMode({ task: TASK, output: { set: { '$.a': 'now' } } }, 'script')).toBe(
      'declarative',
    );
  });

  it('opens a legacy binding with both in script mode — what the runtime runs', () => {
    const binding = { task: TASK, mapping: SCRIPT, input: { set: { '$.body.a': '1' } } };
    expect(bindingMappingContent(binding)).toBe('both');
    expect(resolveMappingMode(binding, 'declarative')).toBe('script');
  });

  it('switching drops only the other form', () => {
    const a: MappingBindingLike = { order: 1, task: TASK, mapping: SCRIPT, variableKey: 'v' };
    switchToDeclarative(a);
    expect(a).toEqual({ order: 1, task: TASK, variableKey: 'v' });
    const b: MappingBindingLike = {
      order: 1,
      task: TASK,
      input: { set: { '$.body.a': '1' } },
      output: { into: '$.x' },
    };
    switchToScript(b);
    expect(b).toEqual({ order: 1, task: TASK });
  });
});

describe('validation', () => {
  it('accepts the contract example', () => {
    expect(
      validateMappingBlock('input', {
        set: { '$.body.customerId': 'data.customer.id', '$.headers.x-channel': '"web"' },
      }),
    ).toEqual([]);
    expect(
      validateMappingBlock('output', {
        select: '$.body.score',
        into: '$.kyc.score',
        set: { '$.kyc.checkedAt': 'now', '$.kyc.state': 'instance.currentState' },
      }),
    ).toEqual([]);
  });

  it('input select and into come together', () => {
    expect(
      validateMappingBlock('input', { select: '$.data.customer' }).map((i) => i.field),
    ).toEqual(['into']);
    expect(validateMappingBlock('input', { into: '$.body.c' }).map((i) => i.field)).toEqual([
      'select',
    ]);
    expect(validateMappingBlock('output', { select: '$.body' })).toEqual([]);
  });

  it('accepts any task config field as an input target', () => {
    expect(
      validateMappingBlock('input', {
        set: {
          '$.url': 'task.url.ToString().Replace("API_BASEURL", config.get("Example:ApiBaseUrl", "http://localhost:3001")) + "?c=" + urlEncode(data.customer.id)',
          '$.timeoutSeconds': '30',
          '$.headers.x-channel': '"web"',
        },
      }),
    ).toEqual([]);
    const issues = validateMappingBlock('input', { set: { '$.headers[0]': '1' } });
    expect(issues.map((i) => [i.field, i.part])).toEqual([["set['$.headers[0]']", 'target']]);
    expect(issues[0].message).toContain("task's config");
  });

  it('config is not selectable in an input block', () => {
    const issues = validateMappingBlock('input', { select: '$.config.Example', into: '$.url' });
    expect(issues.map((i) => i.field)).toEqual(['select']);
    expect(issues[0].message).toContain('config.get');
    expect(validateMappingBlock('input', { select: '$.task.body', into: '$.body' })).toEqual([]);
  });

  it('headers is not selectable in an input block', () => {
    const issues = validateMappingBlock('input', { select: '$.headers.x-channel', into: '$.body.channel' });
    expect(issues.map((i) => i.field)).toEqual(['select']);
    expect(issues[0].message).toContain('headers["x-channel"]');
    expect(
      validateMappingBlock('input', { set: { '$.body.channel': 'headers["x-channel"]' } }),
    ).toEqual([]);
  });

  it('rejects index and wildcard write targets', () => {
    expect(validateMappingBlock('output', { into: '$.items[0]' })[0].field).toBe('into');
    expect(validateMappingBlock('output', { set: { '$.items[*]': 'now' } })[0].part).toBe('target');
  });

  it('flags assignment, PascalCase instance/user members, result in input and empty expressions', () => {
    const messages = (phase: 'input' | 'output', expression: string) =>
      validateMappingBlock(phase, {
        set: { [phase === 'input' ? '$.body.a' : '$.a']: expression },
      }).map((i) => i.message);
    expect(messages('output', 'data.x = 1')[0]).toContain('Assignment is disabled');
    expect(messages('output', 'data.n += 1')[0]).toContain('Assignment is disabled');
    expect(messages('output', 'data.amount.AsDouble() >= 1000 && data.a != 2')).toEqual([]);
    expect(messages('output', '"a=b"')).toEqual([]);
    expect(messages('output', 'instance.CurrentState')[0]).toContain('use currentState');
    expect(messages('output', 'user.HasRole("x")')[0]).toContain('use hasRole');
    expect(messages('output', 'context.Instance.CurrentState')).toEqual([]);
    expect(messages('input', 'result.body')[0]).toContain('only available in the output block');
    expect(messages('output', '  ')[0]).toBe('The expression is empty.');
  });
});

describe('set edits keep declaration order', () => {
  const binding = (): MappingBindingLike => ({
    order: 1,
    task: TASK,
    output: {
      select: '$.body.echo',
      set: { '$.z': 'now', '$.a': 'instance.key', '$.m': 'user.available' },
    },
  });
  const keys = (b: MappingBindingLike) => Object.keys((b.output as { set: object }).set);

  it('changes an expression in place', () => {
    const b = binding();
    setSetExpression(b, 'output', '$.a', 'instance.id');
    expect(keys(b)).toEqual(['$.z', '$.a', '$.m']);
    expect((b.output as { set: Record<string, string> }).set['$.a']).toBe('instance.id');
  });

  it('renames at the same position and refuses a duplicate', () => {
    const b = binding();
    expect(renameSetKey(b, 'output', '$.a', '$.b')).toBe('renamed');
    expect(keys(b)).toEqual(['$.z', '$.b', '$.m']);
    expect(renameSetKey(b, 'output', '$.b', '$.z')).toBe('duplicate');
    expect(keys(b)).toEqual(['$.z', '$.b', '$.m']);
  });

  it('moves, appends and removes', () => {
    const b = binding();
    moveSetEntry(b, 'output', '$.m', -1);
    expect(keys(b)).toEqual(['$.z', '$.m', '$.a']);
    moveSetEntry(b, 'output', '$.z', -1);
    expect(keys(b)).toEqual(['$.z', '$.m', '$.a']);
    expect(addSetEntry(b, 'output', '$.z')).toBe('$.z2');
    expect(keys(b)).toEqual(['$.z', '$.m', '$.a', '$.z2']);
    removeSetEntry(b, 'output', '$.m');
    expect(keys(b)).toEqual(['$.z', '$.a', '$.z2']);
  });

  it('drops set, then the block, when the last entry goes', () => {
    const b: MappingBindingLike = { task: TASK, input: { set: { '$.body.a': '1' } } };
    removeSetEntry(b, 'input', '$.body.a');
    expect(b).toEqual({ task: TASK });
  });

  it('places a new member at its contract position and keeps the rest', () => {
    const b: MappingBindingLike = { task: TASK, output: { set: { '$.a': 'now' } } };
    setBlockMember(b, 'output', 'select', '$.body.x');
    expect(Object.keys(b.output as object)).toEqual(['select', 'set']);
    setBlockMember(b, 'output', 'into', '$.x');
    expect(Object.keys(b.output as object)).toEqual(['select', 'into', 'set']);
    setBlockMember(b, 'output', 'select', undefined);
    setBlockMember(b, 'output', 'into', undefined);
    expect(b.output).toEqual({ set: { '$.a': 'now' } });
  });

  it('creates a block on first write without touching other binding members', () => {
    const b: MappingBindingLike = { order: 2, task: TASK, variableKey: 'score' };
    addSetEntry(b, 'input', '$.body.field');
    expect(b).toEqual({
      order: 2,
      task: TASK,
      variableKey: 'score',
      input: { set: { '$.body.field': '' } },
    });
    expect(Object.keys(b)).toEqual(['order', 'task', 'variableKey', 'input']);
  });
});
