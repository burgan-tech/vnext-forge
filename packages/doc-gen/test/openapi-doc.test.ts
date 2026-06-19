import { describe, it, expect } from 'vitest';
import { buildWorkflowOpenApi, createSchemaResolver } from '../src/index.js';

const startSchema = {
  key: 'account-type-selection',
  domain: 'core',
  flow: 'sys-schemas',
  version: '1.0.0',
  attributes: {
    type: 'schema',
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['accountType'],
      properties: { accountType: { type: 'string' } },
    },
  },
};

const approveSchema = {
  key: 'approve-input',
  domain: 'core',
  flow: 'sys-schemas',
  version: '1.0.0',
  attributes: {
    type: 'schema',
    schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: { note: { type: 'string' } } },
  },
};

const masterSchema = {
  key: 'account-master',
  domain: 'core',
  flow: 'sys-schemas',
  version: '1.0.0',
  attributes: {
    type: 'schema',
    schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: { balance: { type: 'number' } } },
  },
};

const ref = (key: string) => ({ key, domain: 'core', flow: 'sys-schemas', version: '1.0.0' });

const workflow = {
  key: 'account-opening',
  domain: 'banking',
  flow: 'sys-flows',
  version: '2.1.0',
  attributes: {
    type: 'F',
    labels: [{ language: 'en', label: 'Account Opening' }],
    schema: ref('account-master'),
    startTransition: { key: 'start', target: 'pending', schema: ref('account-type-selection') },
    states: [
      {
        key: 'pending',
        transitions: [
          { key: 'approve', target: 'approved', triggerType: 0, schema: ref('approve-input') },
          { key: 'auto-escalate', target: 'escalated', triggerType: 1 }, // Automatic — excluded
          { key: 'timer-expire', target: 'expired', triggerType: 2 }, // Scheduled — excluded
        ],
      },
    ],
    sharedTransitions: [{ key: 'cancel-shared', target: 'cancelled', triggerType: 3 }], // Event — included
    functions: [ref('balance-inquiry')],
  },
};

function build() {
  const resolve = createSchemaResolver([startSchema, approveSchema, masterSchema]);
  return buildWorkflowOpenApi(workflow, resolve);
}

describe('buildWorkflowOpenApi', () => {
  it('emits a valid 3.1 envelope with workflow-scoped info', () => {
    const doc = build();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Account Opening API');
    expect(doc.info.version).toBe('2.1.0');
  });

  it('emits start / retry / get / get-data lifecycle paths', () => {
    const doc = build();
    const base = '/api/v1/banking/workflows/account-opening';
    expect(doc.paths[`${base}/instances/start`]).toHaveProperty('post');
    expect(doc.paths[`${base}/instances/{instance}/retry`]).toHaveProperty('post');
    expect(doc.paths[`${base}/instances/{instance}`]).toHaveProperty('get');
    expect(doc.paths[`${base}/instances/{instance}/functions/data`]).toHaveProperty('get');
  });

  it('only externally-triggerable transitions become PATCH operations', () => {
    const doc = build();
    const base = '/api/v1/banking/workflows/account-opening';
    expect(doc.paths[`${base}/instances/{instance}/transitions/approve`]).toHaveProperty('patch'); // Manual
    expect(doc.paths[`${base}/instances/{instance}/transitions/cancel-shared`]).toHaveProperty('patch'); // Event
    expect(doc.paths[`${base}/instances/{instance}/transitions/auto-escalate`]).toBeUndefined(); // Automatic
    expect(doc.paths[`${base}/instances/{instance}/transitions/timer-expire`]).toBeUndefined(); // Scheduled
  });

  it('types transition attributes from the resolved transition schema', () => {
    const doc = build();
    const base = '/api/v1/banking/workflows/account-opening';
    const startBody = doc.paths[`${base}/instances/start`].post as any;
    const allOf = startBody.requestBody.content['application/json'].schema.allOf;
    const attrs = allOf[1].properties.attributes;
    expect(attrs.$ref).toBe('#/components/schemas/AccountTypeSelectionPayload');
    expect(doc.components.schemas.AccountTypeSelectionPayload).toEqual(startSchema.attributes.schema);
  });

  it('types instance data from the master schema', () => {
    const doc = build();
    const dataSchema = doc.components.schemas.InstanceDataResponse as any;
    expect(dataSchema.properties.data.$ref).toBe('#/components/schemas/AccountMasterData');
    expect(doc.components.schemas.AccountMasterData).toEqual(masterSchema.attributes.schema);
  });

  it('emits domain- and instance-scoped function paths', () => {
    const doc = build();
    expect(doc.paths['/api/v1/banking/functions/balance-inquiry']).toHaveProperty('get');
    expect(doc.paths['/api/v1/banking/workflows/account-opening/instances/{instance}/functions/balance-inquiry']).toHaveProperty('post');
  });

  it('falls back to a permissive object schema when a reference is unresolved', () => {
    const doc = buildWorkflowOpenApi(workflow, createSchemaResolver([])); // nothing resolves
    const base = '/api/v1/banking/workflows/account-opening';
    const startBody = doc.paths[`${base}/instances/start`].post as any;
    const attrs = startBody.requestBody.content['application/json'].schema.allOf[1].properties.attributes;
    expect(attrs).toEqual({ type: 'object', additionalProperties: true });
  });
});

describe('createSchemaResolver', () => {
  it('resolves by flow:domain:key and falls back to key-only', () => {
    const resolve = createSchemaResolver([startSchema]);
    expect(resolve(ref('account-type-selection'))).toEqual(startSchema.attributes.schema);
    expect(resolve({ key: 'account-type-selection' })).toEqual(startSchema.attributes.schema);
    expect(resolve({ key: 'missing' })).toBeUndefined();
  });
});
