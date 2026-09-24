import { describe, expect, it } from 'vitest';

import {
  assertSchemaEditorDocument,
  getSchemaSource,
  readSchemaAttributesType,
  setSchemaAttributesType,
} from './SchemaEditorSchema';

describe('SchemaEditorSchema', () => {
  it('preserves standard schema rules and vNext schema extensions in schema properties', () => {
    const document = {
      key: 'customer',
      version: '1.0.0',
      domain: 'demo',
      flow: 'onboarding',
      flowVersion: '1.0.0',
      tags: ['demo'],
      attributes: {
        schema: {
          type: 'object',
          allOf: [
            {
              if: {
                properties: { customerType: { const: 'individual' } },
                required: ['customerType'],
              },
              then: { required: ['tckn'] },
            },
          ],
          properties: {
            status: {
              type: 'string',
              minLength: 2,
              maxLength: 24,
              pattern: '^[a-z]+$',
              enum: ['pending', 'approved'],
              'x-labels': { en: 'Status', tr: 'Durum', de: 'Status' },
              'x-enum': {
                pending: { en: 'Pending', tr: 'Bekliyor' },
                approved: { en: 'Approved', tr: 'Onaylandı' },
              },
              'x-errorMessages': {
                required: { en: 'Status is required.', tr: 'Durum zorunludur.' },
              },
              'x-conditional': {
                showIf: {
                  allOf: [
                    { field: 'enabled', operator: 'equals', value: true },
                    { field: 'customerType', operator: 'in', value: ['individual', 'corporate'] },
                  ],
                },
              },
              'x-lov': {
                source: 'urn:amorphie:func:domain:shared:get-statuses',
                valueField: '$.response.data.code',
                displayField: '$.response.data.name',
                filter: [{ param: 'cityCode', value: '$form.city', required: true }],
              },
              'x-lookup': {
                source: 'urn:amorphie:func:domain:shared:get-status-detail',
                resultField: '$.response.data',
                filter: [{ param: 'statusCode', value: '$form.status', required: true }],
              },
              'x-binding': 'required',
              'x-encryption': { type: 'persisted' },
              'x-validation': {
                rule: 'validateStatus',
                parameters: { allowed: ['pending', 'approved'] },
                errorMessages: { en: 'Status is not open.', tr: 'Durum açık değil.' },
              },
            },
          },
        },
      },
    };

    expect(assertSchemaEditorDocument(document, 'test')).toEqual(document);
    expect(getSchemaSource(document)).toEqual(document.attributes.schema);
  });
});

describe('schema attributes.type', () => {
  const base = { key: 'orders', version: '1.0.0', domain: 'core' };

  it('reads attributes.type only when it is a string', () => {
    expect(readSchemaAttributesType({ ...base, attributes: { type: 'master', schema: {} } })).toBe('master');
    expect(readSchemaAttributesType({ ...base, attributes: { type: 7, schema: {} } })).toBeUndefined();
    expect(readSchemaAttributesType({ ...base })).toBeUndefined();
    expect(readSchemaAttributesType(null)).toBeUndefined();
  });

  it('writes attributes.type and keeps the schema', () => {
    const draft: Record<string, unknown> = { ...base, attributes: { type: 'schema', schema: { type: 'object' } } };
    setSchemaAttributesType(draft, 'master');
    expect(draft.attributes).toEqual({ type: 'master', schema: { type: 'object' } });
  });

  it('creates attributes when missing', () => {
    const draft: Record<string, unknown> = { ...base };
    setSchemaAttributesType(draft, 'view');
    expect(draft.attributes).toEqual({ type: 'view' });
  });

  it('opens documents with any attributes.type for repair', () => {
    const numeric = { ...base, attributes: { type: 7, schema: { type: 'object' } } };
    expect(assertSchemaEditorDocument(numeric, 'test')).toEqual(numeric);
  });
});
