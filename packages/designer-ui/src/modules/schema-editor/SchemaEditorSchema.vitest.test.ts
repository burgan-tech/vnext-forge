import { describe, expect, it } from 'vitest';

import { assertSchemaEditorDocument, getSchemaSource } from './SchemaEditorSchema';

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
