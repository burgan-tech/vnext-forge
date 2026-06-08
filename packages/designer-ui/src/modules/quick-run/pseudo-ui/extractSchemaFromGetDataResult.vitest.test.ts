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

  it('extracts schema from data.attributes.schema (vNext engine envelope)', () => {
    // Real-world payload taken from the engine response for a
    // `sys-schemas/instances/<key>` getData call. The JSON Schema
    // lives under the instance's `attributes.schema` field.
    const enginePayload = {
      data: {
        id: 'e08cf083-1822-46f0-9ac3-90d4f37519c7',
        key: 'account-type-selection',
        flow: 'sys-schemas',
        domain: 'core',
        attributes: {
          type: 'workflow',
          schema: {
            $id: 'urn:vnext:res:schema:core:account-type-selection',
            type: 'object',
            title: 'Account Type Selection Schema',
            properties: {
              accountType: {
                type: 'string',
                enum: ['demand-deposit', 'time-deposit'],
              },
            },
          },
        },
        extensions: {},
      },
    };
    const schema = extractSchemaFromGetDataResult(enginePayload);
    expect(schema).not.toBeNull();
    expect((schema as { properties: Record<string, unknown> }).properties.accountType).toEqual({
      type: 'string',
      enum: ['demand-deposit', 'time-deposit'],
    });
  });

  it('extracts schema from attributes.schema when engine instance handed directly (no QuickRunApi wrapper)', () => {
    const engineInstance = {
      key: 'account-type-selection',
      attributes: {
        schema: {
          type: 'object',
          properties: { accountType: { type: 'string' } },
        },
      },
    };
    expect(extractSchemaFromGetDataResult(engineInstance)).toMatchObject({
      type: 'object',
      properties: { accountType: { type: 'string' } },
    });
  });
});
