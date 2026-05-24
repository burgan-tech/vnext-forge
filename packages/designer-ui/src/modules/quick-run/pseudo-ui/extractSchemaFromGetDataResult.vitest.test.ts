import { describe, expect, it } from 'vitest';

import { extractSchemaFromGetDataResult } from './extractSchemaFromGetDataResult';

describe('extractSchemaFromGetDataResult (R22)', () => {
  const schema = {
    type: 'object',
    properties: {
      currency: { type: 'string', enum: ['TRY', 'USD'] },
    },
  };

  it('returns the schema from result.data.data.schema (legacy / current expected shape)', () => {
    const envelope = { data: { data: { schema } } };
    expect(extractSchemaFromGetDataResult(envelope)).toEqual(schema);
  });

  it('returns the schema from result.data.schema (user-reported single-envelope shape)', () => {
    const envelope = { data: { schema } };
    expect(extractSchemaFromGetDataResult(envelope)).toEqual(schema);
  });

  it('returns the schema when result.data.data is the schema in-place', () => {
    const envelope = { data: { data: schema } };
    expect(extractSchemaFromGetDataResult(envelope)).toEqual(schema);
  });

  it('returns the schema when result.data is the schema in-place (no envelope)', () => {
    const envelope = { data: schema };
    expect(extractSchemaFromGetDataResult(envelope)).toEqual(schema);
  });

  it('accepts schemas whose only marker is `properties` (no `type` declared)', () => {
    const schemaNoType = { properties: { amount: { type: 'number' } } };
    const envelope = { data: { schema: schemaNoType } };
    expect(extractSchemaFromGetDataResult(envelope)).toEqual(schemaNoType);
  });

  it('does not mistake plain runtime instance data for a schema', () => {
    // Typical sys-instance data has neither `properties` nor `type==='object'`.
    const envelope = { data: { data: { amount: 100, currency: 'TRY' } } };
    expect(extractSchemaFromGetDataResult(envelope)).toBeNull();
  });

  it('prefers data.data.schema over data.schema when both are present', () => {
    const inner = { type: 'object', properties: { a: { type: 'string' } } };
    const outer = { type: 'object', properties: { b: { type: 'string' } } };
    const envelope = { data: { schema: outer, data: { schema: inner } } };
    expect(extractSchemaFromGetDataResult(envelope)).toEqual(inner);
  });

  it('returns null for an empty / missing envelope', () => {
    expect(extractSchemaFromGetDataResult(null)).toBeNull();
    expect(extractSchemaFromGetDataResult(undefined)).toBeNull();
    expect(extractSchemaFromGetDataResult({})).toBeNull();
    expect(extractSchemaFromGetDataResult({ data: null })).toBeNull();
    expect(extractSchemaFromGetDataResult({ data: 'oops' })).toBeNull();
  });

  it('returns null when the schema field is an array (not a JSON-schema object)', () => {
    const envelope = { data: { schema: ['TRY', 'USD'] } };
    expect(extractSchemaFromGetDataResult(envelope)).toBeNull();
  });
});
