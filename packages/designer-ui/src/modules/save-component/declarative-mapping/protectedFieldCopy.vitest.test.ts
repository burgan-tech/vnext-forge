import { describe, expect, it } from 'vitest';

import {
  inputReads,
  protectedCopyIssues,
  protectedPaths,
  writePathSegments,
} from './protectedFieldCopy';

const SCHEMA = {
  type: 'object',
  properties: {
    email: { type: 'string', 'x-encryption': { type: 'encrypt' } },
    tckn: { type: 'string', 'x-encryption': { type: 'hash' } },
    note: { type: 'string', 'x-encryption': { type: 'none' } },
    contactNote: { type: 'string' },
    customer: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        'phone-no': { type: 'string', 'x-encryption': { type: 'encrypt' } },
      },
    },
    archive: { type: 'object', properties: { customer: { type: 'object' } } },
  },
};

describe('protectedPaths', () => {
  it('lists encrypt and hash fields, nested, and skips none', () => {
    expect(protectedPaths(SCHEMA)).toEqual([
      { segments: ['email'], type: 'encrypt' },
      { segments: ['tckn'], type: 'hash' },
      { segments: ['customer', 'phone-no'], type: 'encrypt' },
    ]);
  });

  it('is empty without a schema', () => {
    expect(protectedPaths(undefined)).toEqual([]);
  });
});

describe('writePathSegments', () => {
  it.each([
    ['$.a.b', ['a', 'b']],
    ["$['a b'].c", ['a b', 'c']],
    ['$.customer.phone-no', ['customer', 'phone-no']],
  ])('%s', (path, segments) => {
    expect(writePathSegments(path)).toEqual(segments);
  });

  it('rejects the root and non-paths', () => {
    expect(writePathSegments('$')).toBeUndefined();
    expect(writePathSegments('a.b')).toBeUndefined();
  });
});

describe('inputReads', () => {
  it('reads member and indexer forms', () => {
    expect(inputReads('input.email')).toEqual([['email']]);
    expect(inputReads('input["customer"]["phone-no"]')).toEqual([['customer', 'phone-no']]);
    expect(inputReads("input.customer['phone-no']")).toEqual([['customer', 'phone-no']]);
    expect(inputReads('input.name + " " + input.email')).toEqual([['name'], ['email']]);
  });

  it('ignores string literals, other roots and a member named input', () => {
    expect(inputReads('"input.email"')).toEqual([]);
    expect(inputReads('data.email')).toEqual([]);
    expect(inputReads('data.input.email')).toEqual([]);
  });

  it('drops a trailing method call', () => {
    expect(inputReads('input.amount.AsDouble() > 10')).toEqual([['amount']]);
  });
});

describe('protectedCopyIssues', () => {
  const run = (set: Record<string, string>, schema: unknown = SCHEMA) =>
    protectedCopyIssues('output', { set }, schema);

  it('warns when an encrypt field from input is written to an unprotected path', () => {
    const issues = run({ '$.contactNote': 'input.email' });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      field: "set['$.contactNote']",
      part: 'expression',
      severity: 'warning',
    });
    expect(issues[0].message).toContain('$.email');
    expect(issues[0].message).toContain('encrypt');
  });

  it('warns for a hash field and inside a composed expression', () => {
    expect(run({ '$.contactNote': 'input.tckn' })[0].message).toContain('hash');
    expect(run({ '$.contactNote': 'input.name + " " + input.email' })).toHaveLength(1);
  });

  it('warns when the read object contains a protected field', () => {
    expect(run({ '$.archive.customer': 'input.customer' })).toHaveLength(1);
  });

  it('is silent when written back to its own path or to another protected path', () => {
    expect(run({ '$.email': 'input.email' })).toEqual([]);
    expect(run({ '$.customer': 'input.customer' })).toEqual([]);
    expect(run({ '$.tckn': 'input.email' })).toEqual([]);
  });

  it('is silent for data, unprotected fields, input blocks and without a schema', () => {
    expect(run({ '$.contactNote': 'data.email' })).toEqual([]);
    expect(run({ '$.contactNote': 'input.customer.name' })).toEqual([]);
    expect(run({ '$.contactNote': 'input.note' })).toEqual([]);
    expect(protectedCopyIssues('input', { set: { '$.body.email': 'input.email' } }, SCHEMA)).toEqual([]);
    expect(protectedCopyIssues('output', { set: { '$.contactNote': 'input.email' } }, undefined)).toEqual([]);
  });
});
