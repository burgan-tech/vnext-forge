import { describe, expect, it } from 'vitest';

import {
  expressionSuggestions,
  expressionTokenAt,
  expressionVariables,
  insertExpressionItem,
  selectPaths,
  writeTargetPaths,
} from './declarativeMappingCompletions';

const MASTER_SCHEMA = {
  type: 'object',
  properties: {
    customer: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        'full name': { type: 'string' },
        'x-ref': { type: 'string' },
      },
    },
    amount: { type: 'number' },
    items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' } } } },
  },
};

describe('write targets', () => {
  it('output: master schema properties as $.a.b paths', () => {
    expect(writeTargetPaths('output', MASTER_SCHEMA)).toEqual([
      '$.customer',
      '$.customer.id',
      "$.customer['full name']",
      '$.customer.x-ref',
      '$.amount',
      '$.items',
    ]);
  });

  it('output without a master schema offers nothing', () => {
    expect(writeTargetPaths('output', undefined)).toEqual([]);
  });

  it('input: common task config fields', () => {
    expect(writeTargetPaths('input', MASTER_SCHEMA)).toEqual([
      '$.url',
      '$.method',
      '$.body',
      '$.headers',
      '$.timeoutSeconds',
      '$.queryString',
      '$.data',
    ]);
  });
});

describe('select paths', () => {
  it('output reads result', () => {
    expect(selectPaths('output', MASTER_SCHEMA)).toEqual([
      '$',
      '$.body',
      '$.headers',
      '$.statusCode',
    ]);
  });

  it('input starts with a variable', () => {
    const paths = selectPaths('input', MASTER_SCHEMA);
    expect(paths).toContain('$.data.customer.id');
    expect(paths).toContain('$.input');
    expect(paths).toContain('$.instance.currentState');
    expect(paths).toContain('$.task.url');
    expect(paths).toContain('$.user.available');
    expect(paths.every((p) => /^\$\.(data|input|instance|task|user)/.test(p))).toBe(true);
  });
});

describe('expression completion', () => {
  const at = (text: string) => expressionTokenAt(text, text.length);

  it('reads the member chain at the caret', () => {
    expect(at('data.customer.na')).toEqual({ start: 14, query: 'na', chain: ['data', 'customer'] });
    expect(at('a + instance.')).toEqual({ start: 13, query: '', chain: ['instance'] });
    expect(at('data?.customer?.i')).toEqual({ start: 16, query: 'i', chain: ['data', 'customer'] });
    expect(at('us')).toEqual({ start: 0, query: 'us', chain: [] });
    expect(at('"data.')).toBeNull();
    expect(at('user.hasRole("x").')).toBeNull();
  });

  it('variables: result only in the output phase', () => {
    expect(expressionVariables('input')).toEqual([
      'data',
      'input',
      'instance',
      'now',
      'user',
      'context',
      'task',
      'config',
      'headers',
      'urlEncode()',
    ]);
    expect(expressionVariables('output')).toContain('result');
    expect(expressionSuggestions('input', at('re')!, MASTER_SCHEMA)).toEqual([]);
    expect(expressionSuggestions('output', at('re')!, MASTER_SCHEMA)).toEqual(['result']);
  });

  it('headers: has("") after headers., caret inside the quotes', () => {
    expect(expressionSuggestions('input', at('head')!, undefined)).toEqual(['headers']);
    expect(expressionSuggestions('output', at('headers.')!, undefined)).toEqual(['has("")']);
    expect(expressionSuggestions('input', at('headers.h')!, undefined)).toEqual(['has("")']);
    const token = at('headers.h')!;
    expect(insertExpressionItem('headers.h', token, 9, 'has("")')).toEqual({
      text: 'headers.has("")',
      caret: 'headers.has("'.length,
    });
  });

  it('task, config and urlEncode', () => {
    expect(expressionSuggestions('input', at('task.ur')!, undefined)).toEqual(['url']);
    expect(expressionSuggestions('output', at('config.')!, undefined)).toEqual(['get("")']);
    expect(expressionSuggestions('input', at('urlE')!, undefined)).toEqual(['urlEncode()']);
    const token = at('a + urlE')!;
    expect(insertExpressionItem('a + urlE', token, 8, 'urlEncode()')).toEqual({
      text: 'a + urlEncode()',
      caret: 14,
    });
  });

  it('instance members are camelCase', () => {
    expect(expressionSuggestions('output', at('instance.')!, undefined)).toEqual([
      'id',
      'key',
      'flow',
      'version',
      'currentState',
      'effectiveState',
      'effectiveStateType',
      'effectiveStateSubType',
      'effectiveStatus',
      'type',
      'data',
    ]);
    expect(expressionSuggestions('output', at('instance.eff')!, undefined)).toEqual([
      'effectiveState',
      'effectiveStateType',
      'effectiveStateSubType',
      'effectiveStatus',
    ]);
  });

  it('user and result members', () => {
    expect(expressionSuggestions('input', at('user.')!, undefined)).toEqual([
      'available',
      'roles',
      'hasRole("")',
    ]);
    expect(expressionSuggestions('output', at('result.')!, undefined)).toEqual([
      'body',
      'headers',
      'statusCode',
    ]);
    expect(expressionSuggestions('input', at('result.')!, undefined)).toEqual([]);
  });

  it('data walks the master schema (identifier names only) and offers JSON conversions', () => {
    expect(expressionSuggestions('output', at('data.')!, MASTER_SCHEMA)).toEqual([
      'customer',
      'amount',
      'items',
    ]);
    expect(expressionSuggestions('output', at('data.customer.')!, MASTER_SCHEMA)).toEqual([
      'id',
      'AsDouble()',
      'AsInt32()',
      'AsBoolean()',
      'AsArrayLength()',
    ]);
    expect(expressionSuggestions('output', at('instance.data.cu')!, MASTER_SCHEMA)).toEqual([
      'customer',
    ]);
    expect(expressionSuggestions('output', at('result.body.score.As')!, undefined)).toEqual([
      'AsDouble()',
      'AsInt32()',
      'AsBoolean()',
      'AsArrayLength()',
    ]);
  });

  it('inserts over the typed member; hasRole puts the caret inside the quotes', () => {
    const text = 'user.ha';
    const token = at(text)!;
    expect(insertExpressionItem(text, token, text.length, 'hasRole("")')).toEqual({
      text: 'user.hasRole("")',
      caret: 'user.hasRole("'.length,
    });
    const t2 = 'data.amount.As > 1';
    const token2 = expressionTokenAt(t2, 'data.amount.As'.length)!;
    expect(insertExpressionItem(t2, token2, 'data.amount.As'.length, 'AsDouble()').text).toBe(
      'data.amount.AsDouble() > 1',
    );
  });
});
