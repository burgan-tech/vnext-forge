/**
 * Phase C2 sites (runtime vnext#1227): an event's `input` block (document `{ key, attributes }`),
 * a workflow's `output` block and a function's `output` block (document `{ data, statusCode, headers }`).
 * The static checks mirror `DeclarativeMappingPlan` + `MappingBlockValidator` as built; completions follow
 * each site's variables. A workflow / function `output` holds a script OR a block in one member: the mode
 * switch replaces the object, never mixing both kinds of members.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ownerMappingContent,
  ownerKeepBlocks,
  ownerKeepScript,
  ownerSwitchToDeclarative,
  ownerSwitchToScript,
  outputMappingContent,
  setBlockMember,
  setSetExpression,
  siteKindOf,
  updateEventOwner,
  validateMappingBlock,
  type MappingBindingLike,
  type MappingBlock,
  type MappingSiteKind,
} from './declarativeMapping';
import {
  expressionSuggestions,
  expressionTokenAt,
  expressionVariables,
  resultSlotsOf,
  selectPaths,
  writeTargetPaths,
} from './declarativeMappingCompletions';
import { TaskBindingMappingField } from './TaskBindingMappingField';

const errors = (site: MappingSiteKind, block: MappingBlock, options?: { rawResponse?: boolean }) =>
  validateMappingBlock(site, block, options).filter((i) => i.severity === 'error');
const warnings = (site: MappingSiteKind, block: MappingBlock, options?: { rawResponse?: boolean }) =>
  validateMappingBlock(site, block, options).filter((i) => i.severity === 'warning');

const SLOTS = ['scoreTask', 'customer'];
const suggest = (site: MappingSiteKind, text: string) =>
  expressionSuggestions(site, expressionTokenAt(text, text.length)!, undefined, { resultSlots: SLOTS });

describe('site kinds', () => {
  it('maps the new owners to the runtime sites', () => {
    expect(siteKindOf('event', 'input')).toBe('eventInput');
    expect(siteKindOf('workflowOutput', 'output')).toBe('workflowOutput');
    expect(siteKindOf('functionOutput', 'output')).toBe('functionOutput');
  });
});

describe('event input', () => {
  it('accepts the documented block', () => {
    expect(
      errors('eventInput', {
        select: '$.input.customer',
        into: '$.attributes.customer',
        set: { '$.key': 'input.applicationId', '$.attributes.channel': 'headers["x-channel"]', '$.attributes.at': 'now' },
      }),
    ).toEqual([]);
  });

  it('targets key (whole) and attributes only', () => {
    expect(errors('eventInput', { set: { '$.foo': 'now' } })[0].message).toContain('$.key, $.attributes');
    expect(errors('eventInput', { set: { '$.key.part': 'now' } })[0].message).toContain('as a whole');
    expect(errors('eventInput', { set: { '$.attributes': 'input' } })).toEqual([]);
  });

  it('selects from input, now or context; not data, instance, user or headers', () => {
    expect(errors('eventInput', { select: '$.context.x', into: '$.attributes.x' })).toEqual([]);
    expect(errors('eventInput', { select: '$.data.x', into: '$.attributes.x' })[0].field).toBe('select');
    expect(errors('eventInput', { select: '$.headers.x', into: '$.attributes.x' })[0].message).toContain('headers is not selectable');
  });

  it('rejects data, instance and user in expressions', () => {
    for (const v of ['data.customer', 'instance.id', 'user.available']) {
      const found = errors('eventInput', { set: { '$.key': v } });
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain(`${v.split('.')[0]} does not exist in an event mapping`);
    }
    expect(errors('eventInput', { set: { '$.key': 'result.body' } })[0].message).toContain('result');
  });

  it('pairs select and into, and rejects an empty set', () => {
    expect(errors('eventInput', { select: '$.input' })[0].field).toBe('into');
    expect(errors('eventInput', { into: '$.attributes' })[0].field).toBe('select');
    expect(errors('eventInput', { set: {} })[0].field).toBe('set');
  });

  it('completes the event variables and targets', () => {
    expect(expressionVariables('eventInput')).toEqual(['input', 'now', 'context', 'headers']);
    expect(suggest('eventInput', 'data.')).toEqual([]);
    expect(suggest('eventInput', 'headers.')).toContain('has("")');
    expect(writeTargetPaths('eventInput', undefined)).toEqual(['$.key', '$.attributes']);
    expect(selectPaths('eventInput', undefined)).toEqual(['$.input', '$.context']);
  });
});

describe('workflow output', () => {
  it('accepts the documented block', () => {
    expect(
      errors('workflowOutput', {
        select: '$.data.customer',
        into: '$.data.customer',
        set: { '$.statusCode': '201', '$.headers.x-instance': 'instance.id', '$.data.by': 'user.available ? "u" : "s"' },
      }),
    ).toEqual([]);
  });

  it('targets data, statusCode (whole) and headers', () => {
    expect(errors('workflowOutput', { set: { '$.customer': 'data.customer' } })[0].message).toContain('$.data, $.statusCode, $.headers');
    expect(errors('workflowOutput', { set: { '$.statusCode.x': '1' } })[0].message).toContain('as a whole');
  });

  it('selects from a variable other than headers; no result', () => {
    expect(errors('workflowOutput', { select: '$.input', into: '$.data' })).toEqual([]);
    expect(errors('workflowOutput', { select: '$.headers', into: '$.data' })[0].field).toBe('select');
    expect(errors('workflowOutput', { set: { '$.data.x': 'result.body' } })[0].message).toContain('result');
  });

  it('pairs select and into', () => {
    expect(errors('workflowOutput', { select: '$.data' })[0].field).toBe('into');
    expect(errors('workflowOutput', { into: '$.data' })[0].field).toBe('select');
  });

  it('completes the condition variables and the response targets', () => {
    expect(expressionVariables('workflowOutput')).toEqual(['data', 'input', 'instance', 'now', 'user', 'context', 'headers']);
    expect(writeTargetPaths('workflowOutput', undefined)).toEqual(['$.data', '$.statusCode', '$.headers']);
    expect(selectPaths('workflowOutput', undefined)).toContain('$.input');
  });
});

describe('function output', () => {
  it('accepts the documented block', () => {
    expect(
      errors(
        'functionOutput',
        {
          select: '$.scoreTask.body',
          into: '$.data',
          set: { '$.statusCode': 'result.scoreTask.statusCode', '$.headers.x-fn': '"score"' },
        },
        { rawResponse: true },
      ),
    ).toEqual([]);
  });

  it('has no caller: user is an error', () => {
    const found = errors('functionOutput', { set: { '$.data.x': 'user.available' } });
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('function output has no caller');
  });

  it('warns that statusCode / headers are ignored without rawResponse', () => {
    const w = warnings('functionOutput', { set: { '$.statusCode': '201', '$.headers.x': '"a"', '$.data.y': '1' } });
    expect(w.map((i) => i.field)).toEqual(["set['$.statusCode']", "set['$.headers.x']"]);
    expect(w[0].message).toContain('rawResponse');
    expect(warnings('functionOutput', { select: '$.scoreTask.headers', into: '$.headers' })[0].field).toBe('into');
    expect(warnings('functionOutput', { set: { '$.statusCode': '201' } }, { rawResponse: true })).toEqual([]);
  });

  it('pairs select and into (no default select)', () => {
    expect(errors('functionOutput', { select: '$.scoreTask.body' })[0].field).toBe('into');
    expect(errors('functionOutput', { into: '$.data' })[0].field).toBe('select');
  });

  it('completes result slots from the task list, without user', () => {
    expect(expressionVariables('functionOutput')).toEqual(['data', 'input', 'instance', 'now', 'context', 'headers', 'result']);
    expect(suggest('functionOutput', 'result.')).toEqual(SLOTS);
    expect(suggest('functionOutput', 'result.scoreTask.')).toEqual(['body', 'headers', 'statusCode']);
    expect(suggest('functionOutput', 'user.')).toEqual([]);
    expect(selectPaths('functionOutput', undefined, { resultSlots: SLOTS })).toEqual([
      '$.scoreTask', '$.scoreTask.body', '$.scoreTask.headers', '$.scoreTask.statusCode',
      '$.customer', '$.customer.body', '$.customer.headers', '$.customer.statusCode',
    ]);
  });

  it('reads the slots of every task entry (variableKey, else the task key as a variable name)', () => {
    expect(
      resultSlotsOf([
        { order: 1, task: { key: 'score-task' } },
        { order: 2, task: { key: 'get-customer' }, variableKey: 'customer' },
        { order: 3, task: {} },
      ]),
    ).toEqual(['scoreTask', 'customer']);
  });
});

describe('output member: script or block', () => {
  const script = { location: './src/Out.csx', code: 'cmV0dXJuIG51bGw7', encoding: 'B64' };

  it('classifies the stored output', () => {
    expect(outputMappingContent(undefined)).toBe('empty');
    expect(outputMappingContent(script)).toBe('script');
    expect(outputMappingContent({ set: { '$.data': 'data' } })).toBe('declarative');
    expect(outputMappingContent({ ...script, select: '$.data', into: '$.data' })).toBe('both');
    expect(ownerMappingContent('workflowOutput', { output: script, input: { x: 1 } })).toBe('script');
    expect(ownerMappingContent('event', { mapping: script, input: { set: { '$.key': 'input.id' } } })).toBe('both');
  });

  it('switching modes replaces the object and leaves the other members alone', () => {
    const attrs: MappingBindingLike = { type: 'F', output: script, input: { keep: true } };
    ownerSwitchToDeclarative('workflowOutput')(attrs);
    expect(attrs).toEqual({ type: 'F', input: { keep: true } });
    setBlockMember(attrs, 'output', 'set', { '$.data': 'data' });
    expect(attrs.output).toEqual({ set: { '$.data': 'data' } });
    ownerSwitchToScript('functionOutput')(attrs);
    expect(attrs).toEqual({ type: 'F', input: { keep: true } });
  });

  it('resolving both keeps one kind of members', () => {
    const a: MappingBindingLike = { output: { ...script, select: '$.data', into: '$.data', set: { '$.statusCode': '200' } } };
    ownerKeepScript('workflowOutput')(a);
    expect(a.output).toEqual(script);
    const b: MappingBindingLike = { output: { ...script, scripts: { helpers: [] }, select: '$.data', into: '$.data' } };
    ownerKeepBlocks('functionOutput')(b);
    expect(b.output).toEqual({ select: '$.data', into: '$.data' });
    const e: MappingBindingLike = { mapping: script, input: { set: { '$.key': 'input.id' } } };
    ownerKeepBlocks('event')(e);
    expect(e).toEqual({ input: { set: { '$.key': 'input.id' } } });
  });

  it('a script output round-trips byte for byte; a block edit keeps set order', () => {
    const text = JSON.stringify({ attributes: { output: script, other: 1 } }, null, 2);
    const doc = JSON.parse(text) as { attributes: MappingBindingLike };
    expect(ownerMappingContent('workflowOutput', doc.attributes)).toBe('script');
    expect(JSON.stringify(doc, null, 2)).toBe(text);

    const blockText = JSON.stringify(
      { attributes: { output: { select: '$.data.a', into: '$.data', set: { '$.statusCode': '201', '$.data.b': 'now', '$.headers.x': '"1"' } } } },
      null,
      2,
    );
    const blockDoc = JSON.parse(blockText) as { attributes: MappingBindingLike };
    setSetExpression(blockDoc.attributes, 'output', '$.data.b', 'instance.id');
    expect(JSON.stringify(blockDoc, null, 2)).toBe(blockText.replace('"now"', '"instance.id"'));
  });
});

describe('mode field rendering', () => {
  const render = (owner: 'event' | 'workflowOutput' | 'functionOutput', binding: MappingBindingLike) =>
    renderToStaticMarkup(
      createElement(TaskBindingMappingField, {
        binding,
        owner,
        onUpdate: () => undefined,
        renderScript: () => createElement('div', { 'data-script': 'yes' }),
      }),
    );

  it('a workflow output script opens the script editor', () => {
    const html = render('workflowOutput', { output: { location: './Out.csx', code: '' } });
    expect(html).toContain('data-testid="workflowOutput-mapping"');
    expect(html).toContain('data-script="yes"');
    expect(html).not.toContain('data-testid="declarative-output"');
  });

  it('a workflow / function output block opens the declarative editor', () => {
    expect(render('workflowOutput', { output: { set: { '$.statusCode': '201' } } })).toContain('data-testid="declarative-output"');
    const fn = render('functionOutput', { output: { set: { '$.data': 'result' } } });
    expect(fn).toContain('data-testid="declarative-output"');
    expect(fn).not.toContain('data-testid="declarative-input"');
  });

  it('an event input opens the declarative input editor; both shows the conflict', () => {
    const html = render('event', { input: { set: { '$.key': 'input.id' } } });
    expect(html).toContain('data-testid="declarative-input"');
    expect(html).not.toContain('data-testid="declarative-output"');
    expect(render('event', { mapping: { location: './E.csx' }, input: { set: { '$.key': 'input.id' } } })).toContain('Publish rejects it');
  });
});

describe('event owner', () => {
  it('creates the event on the first edit and drops it when it ends up empty', () => {
    const attrs: Record<string, unknown> = { type: 'F' };
    updateEventOwner(attrs, (e) => setBlockMember(e, 'input', 'set', { '$.key': 'input.id' }));
    expect(attrs).toEqual({ type: 'F', event: { input: { set: { '$.key': 'input.id' } } } });
    updateEventOwner(attrs, (e) => setBlockMember(e, 'input', 'set', undefined));
    expect(attrs).toEqual({ type: 'F' });
  });

  it('switching an event to declarative drops the mapping; an empty event is removed', () => {
    const t: Record<string, unknown> = { key: 'go', event: { mapping: { location: './E.csx' } } };
    updateEventOwner(t, ownerSwitchToDeclarative('event'));
    expect(t).toEqual({ key: 'go' });
  });
});

describe('select / into pairing message', () => {
  const intoMessage = (site: MappingSiteKind, select: string) =>
    errors(site, { select }).find((i) => i.field === 'into')?.message;

  it('names the document path once for a new site', () => {
    expect(intoMessage('workflowOutput', '$.data.score')).toBe(
      'An output response select needs an into naming the response path it copies to.',
    );
  });

  it('keeps the SubFlow input text', () => {
    expect(intoMessage('subFlowInput', '$.data.customer')).toBe(
      'A SubFlow input select needs an into naming the start-request path it copies to.',
    );
  });
});
