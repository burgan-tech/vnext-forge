/**
 * Declarative blocks outside task bindings (runtime vnext#1227): a transition's
 * `output`, a SubFlow state's `input` / `output`. The static checks mirror
 * `MappingBlockValidator` + `DeclarativeMappingPlan`; completions follow each
 * site's variables (`ExpressionSignatures.Mapping`).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  firstPathSegment,
  isSubFlowInputWritePath,
  siteKindOf,
  subFlowBlockIssues,
  transitionBlockIssues,
  transitionTakesOutput,
  validateMappingBlock,
  type MappingBlock,
  type MappingSiteKind,
} from './declarativeMapping';
import {
  expressionSuggestions,
  expressionTokenAt,
  expressionVariables,
  selectPaths,
  writeTargetPaths,
} from './declarativeMappingCompletions';
import { protectedCopyIssues } from './protectedFieldCopy';
import { TaskBindingMappingField } from './TaskBindingMappingField';

const SCHEMA = {
  type: 'object',
  properties: {
    customer: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string', 'x-encryption': { type: 'encrypt' } } } },
    amount: { type: 'number' },
  },
};

const errors = (site: MappingSiteKind, block: MappingBlock) =>
  validateMappingBlock(site, block).filter((i) => i.severity === 'error');

const suggest = (site: MappingSiteKind, text: string) =>
  expressionSuggestions(site, expressionTokenAt(text, text.length)!, SCHEMA);

describe('site kinds', () => {
  it('maps owner and phase to the runtime site', () => {
    expect(siteKindOf('task', 'input')).toBe('taskInput');
    expect(siteKindOf('task', 'output')).toBe('taskOutput');
    expect(siteKindOf('transition', 'output')).toBe('transitionOutput');
    expect(siteKindOf('subFlow', 'input')).toBe('subFlowInput');
    expect(siteKindOf('subFlow', 'output')).toBe('subFlowOutput');
  });

  it('reads the first path segment', () => {
    expect(firstPathSegment('$')).toBe('');
    expect(firstPathSegment('$.input.customer')).toBe('input');
    expect(firstPathSegment("$['attributes'].x")).toBe('attributes');
    expect(firstPathSegment('$[0]')).toBe('');
    expect(firstPathSegment('nope')).toBeUndefined();
  });
});

describe('transition output', () => {
  it('accepts the documented block', () => {
    expect(
      errors('transitionOutput', {
        select: '$.input.customer',
        into: '$.customer',
        set: { '$.submittedAt': 'now', '$.reviewedByAuditor': 'user.available && user.hasRole("auditor")' },
      }),
    ).toEqual([]);
  });

  it('select starts at a variable other than headers', () => {
    expect(errors('transitionOutput', { select: '$.data.x', into: '$.x' })).toEqual([]);
    expect(errors('transitionOutput', { select: '$.instance.key', into: '$.x' })).toEqual([]);
    expect(errors('transitionOutput', { select: '$.headers.x', into: '$.x' })[0].message).toContain('headers is not selectable');
    expect(errors('transitionOutput', { select: '$', into: '$.x' })[0].message).toContain('starts at a variable');
    expect(errors('transitionOutput', { select: '$.result.body', into: '$.x' })[0].field).toBe('select');
    expect(errors('transitionOutput', { select: '$.task.url', into: '$.x' })[0].field).toBe('select');
  });

  it('into needs a select; a select alone merges at the root', () => {
    expect(errors('transitionOutput', { into: '$.x' })[0].message).toContain('no default source');
    expect(errors('transitionOutput', { select: '$.input' })).toEqual([]);
  });

  it('targets instance data, never the root or an index', () => {
    expect(errors('transitionOutput', { set: { $: 'now' } })[0].part).toBe('target');
    expect(errors('transitionOutput', { set: { '$.a[0]': 'now' } })[0].part).toBe('target');
  });

  it('has no result, task, config or urlEncode', () => {
    for (const expr of ['result.body', 'task.url', 'config.get("K")', 'urlEncode(data.x)']) {
      expect(errors('transitionOutput', { set: { '$.x': expr } })).toHaveLength(1);
    }
    expect(errors('transitionOutput', { set: { '$.x': 'data.result' } })).toEqual([]);
    expect(errors('transitionOutput', { set: { '$.x': '"result"' } })).toEqual([]);
    expect(errors('transitionOutput', { set: { '$.x': 'headers["x-channel"]' } })).toEqual([]);
  });

  it('keeps the shared expression checks (assignment, camelCase)', () => {
    expect(errors('transitionOutput', { set: { '$.x': 'data.a = 1' } })[0].message).toContain('Assignment');
    expect(errors('transitionOutput', { set: { '$.x': 'instance.CurrentState' } })[0].message).toContain('camelCase');
  });

  it('owner rules: no input member, no output on automatic / scheduled', () => {
    expect(transitionBlockIssues({ input: { set: {} } })[0].message).toBe(
      "'input' is not supported on a transition; use 'output'.",
    );
    expect(transitionBlockIssues({ triggerType: 1, output: { select: '$.input' } })[0].message).toContain('automatic');
    expect(transitionBlockIssues({ triggerType: 2, output: { select: '$.input' } })[0].message).toContain('scheduled');
    expect(transitionBlockIssues({ triggerType: 0, output: { select: '$.input' } })).toEqual([]);
    expect(transitionBlockIssues({ triggerType: 3, output: { select: '$.input' } })).toEqual([]);
    expect([0, 1, 2, 3].map(transitionTakesOutput)).toEqual([true, false, false, true]);
  });

  it('completes data targets, variable selects and the site variables', () => {
    expect(writeTargetPaths('transitionOutput', SCHEMA)).toEqual(['$.customer', '$.customer.id', '$.customer.email', '$.amount']);
    const selects = selectPaths('transitionOutput', SCHEMA);
    expect(selects).toContain('$.input');
    expect(selects).toContain('$.data.customer.id');
    expect(selects).toContain('$.instance.currentState');
    expect(selects.some((p) => p.startsWith('$.task') || p.startsWith('$.headers'))).toBe(false);
    expect(expressionVariables('transitionOutput')).toEqual(['data', 'input', 'instance', 'now', 'user', 'context', 'headers']);
    expect(suggest('transitionOutput', 'task.')).toEqual([]);
    expect(suggest('transitionOutput', 'config.')).toEqual([]);
    expect(suggest('transitionOutput', 'result.')).toEqual([]);
    expect(suggest('transitionOutput', 'data.cu')).toEqual(['customer']);
  });

  it('warns when an x-encryption input field is copied to an unprotected path', () => {
    const issues = protectedCopyIssues('transitionOutput', { set: { '$.note': 'input.customer.email' } }, SCHEMA);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(protectedCopyIssues('transitionOutput', { set: { '$.customer.email': 'input.customer.email' } }, SCHEMA)).toEqual([]);
    expect(protectedCopyIssues('subFlowOutput', { set: { '$.note': 'input.customer.email' } }, SCHEMA)).toEqual([]);
  });
});

describe('SubFlow input', () => {
  it('accepts the documented block', () => {
    expect(
      errors('subFlowInput', {
        set: {
          '$.attributes.customerId': 'data.customer.id',
          '$.attributes.amount': 'input.amount',
          '$.headers.x-channel': '"web"',
          '$.key': 'data.customer.id',
          '$.tags': 'new string[] { "kyc" }',
        },
      }),
    ).toEqual([]);
  });

  it('targets the start request; key and tags as a whole', () => {
    expect(isSubFlowInputWritePath('$.attributes.x')).toBe(true);
    expect(isSubFlowInputWritePath("$['headers']['x-a']")).toBe(true);
    expect(isSubFlowInputWritePath('$.key')).toBe(true);
    expect(isSubFlowInputWritePath('$.key.x')).toBe(false);
    expect(isSubFlowInputWritePath('$.data.x')).toBe(false);
    expect(errors('subFlowInput', { set: { '$.customer': 'data.customer' } })[0].message).toContain('$.attributes');
    expect(errors('subFlowInput', { set: { '$.tags[0]': '"a"' } })[0].message).toContain('Not a writable target');
    expect(errors('subFlowInput', { set: { '$.tags.first': '"a"' } })[0].message).toBe('Write $.tags as a whole.');
  });

  it('select and into come together; select starts at a variable', () => {
    expect(errors('subFlowInput', { select: '$.data.customer' })[0].field).toBe('into');
    expect(errors('subFlowInput', { into: '$.attributes.c' })[0].field).toBe('select');
    expect(errors('subFlowInput', { select: '$.data.customer', into: '$.attributes.c' })).toEqual([]);
    expect(errors('subFlowInput', { select: '$.headers.sub', into: '$.headers.sub' })[0].field).toBe('select');
  });

  it('has no result, task or config', () => {
    expect(errors('subFlowInput', { set: { '$.key': 'result.data' } })[0].message).toContain('SubFlow output');
    expect(errors('subFlowInput', { set: { '$.key': 'task.url' } })[0].message).toContain('task mappings only');
  });

  it('completes start-request targets and variable selects', () => {
    expect(writeTargetPaths('subFlowInput', SCHEMA)).toEqual(['$.attributes', '$.headers', '$.key', '$.tags']);
    expect(selectPaths('subFlowInput', SCHEMA)).toEqual(selectPaths('transitionOutput', SCHEMA));
    expect(expressionVariables('subFlowInput')).not.toContain('result');
  });
});

describe('SubFlow output', () => {
  it('accepts the documented block; select reads result', () => {
    expect(
      errors('subFlowOutput', {
        select: '$.data.score',
        into: '$.kyc.score',
        set: { '$.kyc.outcome': 'result.status', '$.kyc.settledAt': 'now' },
      }),
    ).toEqual([]);
    expect(errors('subFlowOutput', { into: '$.child' })).toEqual([]);
    expect(errors('subFlowOutput', { select: '$' })).toEqual([]);
  });

  it('targets instance data', () => {
    expect(errors('subFlowOutput', { into: '$' })[0].field).toBe('into');
  });

  it('completes result members and data targets', () => {
    expect(selectPaths('subFlowOutput', SCHEMA)).toEqual(['$.data', '$.status', '$']);
    expect(writeTargetPaths('subFlowOutput', SCHEMA)).toContain('$.customer.id');
    expect(expressionVariables('subFlowOutput')).toContain('result');
    expect(expressionVariables('subFlowOutput')).not.toContain('task');
    expect(suggest('subFlowOutput', 'result.')).toEqual(['data', 'status']);
    expect(suggest('subFlowOutput', 'result.data.')).toContain('AsDouble()');
    expect(errors('subFlowOutput', { set: { '$.x': 'config.get("K")' } })).toHaveLength(1);
  });

  it('owner rule: blocks on a P SubProcess are rejected', () => {
    expect(subFlowBlockIssues({ type: 'P', output: { into: '$.x' } })[0].message).toContain("SubFlow ('S') only");
    expect(subFlowBlockIssues({ type: 'S', output: { into: '$.x' } })).toEqual([]);
    expect(subFlowBlockIssues({ type: 'P' })).toEqual([]);
  });
});

describe('task sites are unchanged by the generalisation', () => {
  it('a bare phase is a task binding', () => {
    expect(expressionVariables('input')).toContain('task');
    expect(expressionVariables('output')).toContain('result');
    expect(selectPaths('output', SCHEMA)).toEqual(['$', '$.body', '$.headers', '$.statusCode']);
    expect(errors('taskOutput', { set: { '$.x': 'task.url' } })).toEqual([]);
  });
});

describe('mode field per owner', () => {
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(TaskBindingMappingField, {
        onUpdate: () => undefined,
        renderScript: () => createElement('div', { 'data-script': 'yes' }),
        ...props,
      } as never),
    );

  it('a transition renders the output block only', () => {
    const html = render({ binding: { key: 't', output: { select: '$.input' } }, owner: 'transition' });
    expect(html).toContain('data-testid="transition-mapping"');
    expect(html).toContain('data-testid="declarative-output"');
    expect(html).not.toContain('data-testid="declarative-input"');
    expect(html).toContain('value="$.input"');
  });

  it('a SubFlow renders both blocks', () => {
    const html = render({ binding: { type: 'S', process: {} }, owner: 'subFlow' });
    expect(html).toContain('data-testid="declarative-input"');
    expect(html).toContain('data-testid="declarative-output"');
  });

  it('where blocks are not allowed, only the script is offered', () => {
    const html = render({ binding: { type: 'P', process: {} }, owner: 'subFlow', declarativeAllowed: false });
    expect(html).not.toContain('>Declarative<');
    expect(html).toContain('data-script="yes"');
  });

  it('a stored block on a disallowed owner still shows, with the owner finding', () => {
    const binding = { type: 'P', process: {}, output: { into: '$.x' } };
    const html = render({
      binding,
      owner: 'subFlow',
      declarativeAllowed: false,
      ownerIssues: subFlowBlockIssues(binding),
    });
    expect(html).toContain('>Declarative<');
    expect(html).toContain("SubFlow (&#x27;S&#x27;) only");
  });

  it('a transition with both shows the conflict in its own words', () => {
    const html = render({
      binding: { key: 't', mapping: { location: './a.csx', code: '' }, output: { into: '$.x' } },
      owner: 'transition',
    });
    expect(html).toContain('This transition has both');
  });
});
