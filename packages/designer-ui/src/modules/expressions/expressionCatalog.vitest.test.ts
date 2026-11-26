import { describe, expect, it } from 'vitest';

import { expressionVariables } from '../save-component/declarative-mapping/declarativeMappingCompletions';
import type { MappingSiteKind } from '../save-component/declarative-mapping/declarativeMapping';
import {
  conversionsOf,
  describe as describeEntry,
  functionsOf,
  membersOf,
  slotSurfaceOf,
  staticsOf,
  variablesOf,
  type CatalogEntry,
  type ExpressionSurface,
} from './expressionCatalog';

const names = (entries: CatalogEntry[]) => entries.map((e) => e.name);

const ALL_SITES: MappingSiteKind[] = [
  'taskInput',
  'taskOutput',
  'transitionOutput',
  'subFlowInput',
  'subFlowOutput',
  'eventInput',
  'workflowOutput',
  'functionOutput',
];
const ALL_SURFACES: ExpressionSurface[] = [
  ...ALL_SITES,
  'condition',
  'value',
  'key',
  'timer',
  'string',
  'decision',
  'agentTool',
];
const ROOTS = [
  'instance',
  'user',
  'headers',
  'config',
  'task',
  'result',
  'outcome',
  'candidates',
  'context',
];

describe('expression catalog', () => {
  it('slot surfaces carry the runtime variables', () => {
    expect(names(variablesOf('condition'))).toEqual(['data', 'input', 'instance', 'now', 'user', 'context', 'headers']);
    expect(names(variablesOf('decision'))).toEqual([
      'data', 'input', 'instance', 'now', 'user', 'context', 'headers', 'outcome', 'candidates',
    ]);
    expect(names(variablesOf('agentTool'))).toEqual(['args', 'data', 'now']);
  });

  it('block surfaces match expressionVariables (urlEncode is a function there)', () => {
    for (const site of ALL_SITES) {
      expect(names(variablesOf(site))).toEqual(expressionVariables(site).filter((n) => n !== 'urlEncode()'));
    }
  });

  it('task sites expose urlEncode as a function', () => {
    expect(names(functionsOf('taskInput'))).toEqual(['urlEncode']);
    expect(names(functionsOf('taskOutput'))).toEqual(['urlEncode']);
    expect(functionsOf('transitionOutput')).toEqual([]);
  });

  it('lock key and cache key offer sha256 and varyKey', () => {
    expect(names(functionsOf('value'))).toEqual(['sha256', 'varyKey']);
    expect(names(functionsOf('key'))).toEqual(['sha256', 'varyKey']);
    expect(functionsOf('condition')).toEqual([]);
  });

  it('agent tool has no JSON conversions', () => expect(conversionsOf('agentTool')).toEqual([]));

  it('offers the five conversions elsewhere', () => {
    expect(names(conversionsOf('condition'))).toEqual([
      'AsDouble()', 'AsInt32()', 'AsBoolean()', 'AsArrayLength()', 'AsJsonElement()',
    ]);
  });

  it('timer has TimeSpan and DateTime statics only', () => {
    expect(names(staticsOf('timer'))).toEqual(['TimeSpan', 'DateTime']);
    expect(staticsOf('condition')).toEqual([]);
  });

  it('lists outcome, candidates and context members', () => {
    expect(names(membersOf('outcome', 'decision'))).toEqual([
      'completed', 'output', 'text', 'decision', 'reason', 'failureReason',
    ]);
    expect(names(membersOf('candidates', 'decision'))).toEqual(['count', 'keys', 'has("")', 'find("")']);
    expect(names(membersOf('context', 'condition'))).toEqual([
      'Body', 'Headers', 'QueryParameters', 'RouteValues', 'Instance', 'Transition', 'Workflow', 'Runtime',
    ]);
  });

  it('result members follow the block site', () => {
    expect(names(membersOf('result', 'taskOutput'))).toEqual(['body', 'headers', 'statusCode']);
    expect(names(membersOf('result', 'subFlowOutput'))).toEqual(['data', 'status']);
  });

  it('describes AsDouble', () => {
    expect(describeEntry('data', 'AsDouble()', 'condition')?.kind).toBe('conversion');
    expect(describeEntry('amount', 'AsDouble()', 'condition')?.kind).toBe('conversion');
    expect(describeEntry('user', 'roles', 'condition')?.name).toBe('roles');
    expect(describeEntry(null, 'now', 'condition')?.kind).toBe('variable');
    expect(describeEntry(null, 'nope', 'condition')).toBeUndefined();
  });

  it('slotSurfaceOf is the identity', () => {
    for (const kind of ['condition', 'value', 'timer', 'string', 'decision'] as const) {
      expect(slotSurfaceOf(kind)).toBe(kind);
    }
  });

  it('every entry has a description', () => {
    for (const surface of ALL_SURFACES) {
      const all = [
        ...variablesOf(surface),
        ...functionsOf(surface),
        ...conversionsOf(surface),
        ...staticsOf(surface),
        ...ROOTS.flatMap((root) => membersOf(root, surface)),
      ];
      for (const entry of all) expect(entry.description.length, `${surface}/${entry.name}`).toBeGreaterThan(0);
    }
  });
});
