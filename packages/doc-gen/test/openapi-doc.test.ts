import { describe, it, expect } from 'vitest';
import { buildWorkflowOpenApi, createSchemaResolver, createComponentResolver } from '../src/index.js';

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
const fnRef = (key: string) => ({ key, domain: 'banking', flow: 'sys-functions', version: '1.0.0' });
const taskRef = (key: string) => ({ key, domain: 'banking', flow: 'sys-tasks', version: '1.0.0' });

// HTTP task (type '6') with GET method.
const getAccountTask = {
  key: 'get-account',
  domain: 'banking',
  flow: 'sys-tasks',
  version: '1.0.0',
  attributes: { type: '6', config: { method: 'GET', url: 'https://api/accounts/{id}' } },
};
// HTTP task (type '6') with POST + contentType.
const submitTask = {
  key: 'submit-order',
  domain: 'banking',
  flow: 'sys-tasks',
  version: '1.0.0',
  attributes: { type: '6', config: { method: 'POST', url: 'https://api/orders', contentType: 'application/json' } },
};
// Function wrapping a single GET task (attributes.task single-ref form).
const balanceInquiryFn = {
  key: 'balance-inquiry',
  domain: 'banking',
  flow: 'sys-functions',
  version: '1.0.0',
  attributes: { scope: 'D', task: taskRef('get-account') },
};
// Function wrapping a POST task via attributes.tasks[] (multi form).
const placeOrderFn = {
  key: 'place-order',
  domain: 'banking',
  flow: 'sys-functions',
  version: '1.0.0',
  attributes: { scope: 'D', tasks: [{ order: 1, task: taskRef('submit-order') }] },
};

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
      // Same-domain sub-flow: its transitions should fold into this flow.
      { key: 'kyc', subFlow: { process: { key: 'kyc-subflow', domain: 'banking', flow: 'sys-flows', version: '1.0.0' } } },
      // Cross-domain sub-flow: must be skipped (not in this workspace).
      { key: 'external', subFlow: { process: { key: 'ext-subflow', domain: 'other-domain', flow: 'sys-flows', version: '1.0.0' } } },
    ],
    sharedTransitions: [{ key: 'cancel-shared', target: 'cancelled', triggerType: 3 }], // Event — included
    functions: [fnRef('balance-inquiry'), fnRef('place-order'), fnRef('unresolved-fn')],
  },
};

// Same-domain sub-flow workflow with one externally-triggerable transition.
const kycSubflow = {
  key: 'kyc-subflow',
  domain: 'banking',
  flow: 'sys-flows',
  version: '1.0.0',
  attributes: {
    type: 'S',
    startTransition: { key: 'sub-start', target: 'review' },
    states: [
      { key: 'review', transitions: [{ key: 'sub-approve', target: 'done', triggerType: 0, schema: ref('approve-input') }] },
    ],
  },
};

function build() {
  const resolveSchema = createSchemaResolver([startSchema, approveSchema, masterSchema]);
  const resolveComponent = createComponentResolver([
    balanceInquiryFn,
    placeOrderFn,
    getAccountTask,
    submitTask,
    kycSubflow,
  ]);
  return buildWorkflowOpenApi(workflow, { resolveSchema, resolveComponent });
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

  it('emits domain- and instance-scoped function paths with the derived HTTP method', () => {
    const doc = build();
    const inst = '/api/v1/banking/workflows/account-opening/instances/{instance}';
    // balance-inquiry wraps a GET task -> both scopes are GET, no requestBody.
    expect(doc.paths['/api/v1/banking/functions/balance-inquiry']).toHaveProperty('get');
    expect(doc.paths[`${inst}/functions/balance-inquiry`]).toHaveProperty('get');
    expect((doc.paths['/api/v1/banking/functions/balance-inquiry'] as any).get.requestBody).toBeUndefined();
    // place-order wraps a POST task -> POST with a requestBody.
    expect(doc.paths['/api/v1/banking/functions/place-order']).toHaveProperty('post');
    expect((doc.paths['/api/v1/banking/functions/place-order'] as any).post.requestBody).toBeDefined();
  });

  it('defaults an unresolvable function to POST', () => {
    const doc = build();
    expect(doc.paths['/api/v1/banking/functions/unresolved-fn']).toHaveProperty('post');
  });

  it('emits unique operationIds across every operation (domain vs instance function scopes)', () => {
    const doc = build();
    const ids: string[] = [];
    for (const ops of Object.values(doc.paths)) {
      for (const op of Object.values(ops)) {
        const id = (op as { operationId?: string })?.operationId;
        if (id) ids.push(id);
      }
    }
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    // the two scopes of the same function get distinct ids
    expect(ids).toContain('get_domain_function_balance-inquiry');
    expect(ids).toContain('get_instance_function_balance-inquiry');
  });

  it('folds same-domain sub-flow transitions into the parent base path, tagged Sub-flow', () => {
    const doc = build();
    const base = '/api/v1/banking/workflows/account-opening';
    const op = doc.paths[`${base}/instances/{instance}/transitions/sub-approve`] as any;
    expect(op).toHaveProperty('patch');
    expect(op.patch.tags).toContain('Sub-flow');
    expect(op.patch.description).toContain('kyc-subflow');
    expect(op.patch.description).toContain('kyc'); // entered-from state
    // payload typed from the sub-flow transition's schema
    const attrs = op.patch.requestBody.content['application/json'].schema.allOf[1].properties.attributes;
    expect(attrs.$ref).toBe('#/components/schemas/ApproveInputPayload');
  });

  it('skips cross-domain sub-flows (different workspace)', () => {
    const doc = build();
    const base = '/api/v1/banking/workflows/account-opening';
    // ext-subflow is in another domain and not resolvable -> no transitions added.
    const subflowOps = Object.keys(doc.paths).filter((p) => p.includes('/transitions/ext'));
    expect(subflowOps).toHaveLength(0);
  });

  it('falls back to a permissive object schema when a reference is unresolved', () => {
    const doc = buildWorkflowOpenApi(workflow, { resolveSchema: createSchemaResolver([]) }); // nothing resolves
    const base = '/api/v1/banking/workflows/account-opening';
    const startBody = doc.paths[`${base}/instances/start`].post as any;
    const attrs = startBody.requestBody.content['application/json'].schema.allOf[1].properties.attributes;
    expect(attrs).toEqual({ type: 'object', additionalProperties: true });
  });
});

const resolvers = { resolveSchema: () => undefined, resolveComponent: () => undefined };
const roleBase = '/api/v1/test/workflows/role-test';
const txPath = (key: string) => `${roleBase}/instances/{instance}/transitions/${key}`;
const paths = (doc: any) => Object.keys(doc.paths);

const roleWorkflow = {
  key: 'role-test',
  domain: 'test',
  flow: 'sys-flows',
  version: '1.0.0',
  attributes: {
    startTransition: { key: 'start', target: 's1' },
    states: [
      {
        key: 's1',
        transitions: [
          {
            key: 'allow-only',
            target: 'done',
            triggerType: 0,
            roles: [{ role: 'admin', grant: 'allow' }],
          },
          {
            key: 'deny-admin',
            target: 'done',
            triggerType: 0,
            roles: [{ role: 'admin', grant: 'deny' }],
          },
          {
            key: 'no-roles',
            target: 'done',
            triggerType: 0,
          },
          {
            key: 'other-role',
            target: 'done',
            triggerType: 0,
            roles: [{ role: 'auditor', grant: 'allow' }],
          },
          {
            key: 'deny-wins',
            target: 'done',
            triggerType: 0,
            roles: [{ role: 'admin', grant: 'deny' }, { role: 'other', grant: 'allow' }],
          },
        ],
      },
    ],
  },
};

describe('audience filter', () => {
  it('a) no audience filter → all external transitions included', () => {
    const doc = buildWorkflowOpenApi(roleWorkflow as any, resolvers);
    const p = paths(doc);
    expect(p).toContain(txPath('allow-only'));
    expect(p).toContain(txPath('deny-admin'));
    expect(p).toContain(txPath('no-roles'));
    expect(p).toContain(txPath('other-role'));
  });

  it('b) audienceRoles: [admin] → allow match and no-roles included; deny and non-matching excluded', () => {
    const doc = buildWorkflowOpenApi(roleWorkflow as any, resolvers, { audienceRoles: ['admin'] });
    const p = paths(doc);
    expect(p).toContain(txPath('allow-only'));
    expect(p).toContain(txPath('no-roles'));
    expect(p).not.toContain(txPath('deny-admin'));
    expect(p).not.toContain(txPath('other-role'));
  });

  it('c) audienceRoles: [] → same as no filter, all 4 base transitions present', () => {
    const doc = buildWorkflowOpenApi(roleWorkflow as any, resolvers, { audienceRoles: [] });
    const p = paths(doc);
    expect(p).toContain(txPath('allow-only'));
    expect(p).toContain(txPath('deny-admin'));
    expect(p).toContain(txPath('no-roles'));
    expect(p).toContain(txPath('other-role'));
  });

  it('d) DENY overrides ALLOW — deny-wins transition excluded when admin is in audience', () => {
    const doc = buildWorkflowOpenApi(roleWorkflow as any, resolvers, { audienceRoles: ['admin'] });
    expect(paths(doc)).not.toContain(txPath('deny-wins'));
  });

  it('e) startTransition path always present regardless of audience filter', () => {
    const doc = buildWorkflowOpenApi(roleWorkflow as any, resolvers, { audienceRoles: ['admin'] });
    expect(paths(doc)).toContain(`${roleBase}/instances/start`);
  });
});

const labelWorkflow = {
  key: 'label-test',
  domain: 'test',
  flow: 'sys-flows',
  version: '1.0.0',
  attributes: {
    labels: [{ language: 'en', label: 'Label Test' }, { language: 'tr', label: 'Etiket Testi' }],
    startTransition: { key: 'start', target: 's1' },
    states: [
      {
        key: 's1',
        transitions: [
          {
            key: 'approve',
            target: 'done',
            triggerType: 0,
            labels: [{ language: 'en', label: 'Approve' }, { language: 'tr', label: 'Onayla' }],
          },
        ],
      },
    ],
  },
};

describe('language and _comment', () => {
  it('f) language: tr uses Turkish label in transition summary', () => {
    const labelBase = '/api/v1/test/workflows/label-test';
    const docTr = buildWorkflowOpenApi(labelWorkflow as any, resolvers, { language: 'tr' });
    const opTr = (docTr.paths[`${labelBase}/instances/{instance}/transitions/approve`] as any).patch;
    expect(opTr.summary).toContain('Onayla');

    const docEn = buildWorkflowOpenApi(labelWorkflow as any, resolvers, { language: 'en' });
    const opEn = (docEn.paths[`${labelBase}/instances/{instance}/transitions/approve`] as any).patch;
    expect(opEn.summary).toContain('Approve');
  });

  it('g) workflow _comment appears in info.description', () => {
    const commentWorkflow = {
      ...roleWorkflow,
      _comment: 'This is a workflow comment.',
    };
    const doc = buildWorkflowOpenApi(commentWorkflow as any, resolvers);
    expect(doc.info.description).toContain('This is a workflow comment.');
  });

  it('h) audienceRoles badge appears in info.description', () => {
    const doc = buildWorkflowOpenApi(roleWorkflow as any, resolvers, { audienceRoles: ['admin', 'manager'] });
    expect(doc.info.description).toContain('**Audience:** admin, manager');
  });

  it('i) language: fr with no French labels falls back to first available', () => {
    const labelBase = '/api/v1/test/workflows/label-test';
    const doc = buildWorkflowOpenApi(labelWorkflow as any, resolvers, { language: 'fr' });
    // Should not crash and should produce a non-empty title from the available labels
    expect(doc.info.title).toBeTruthy();
    expect(typeof doc.info.title).toBe('string');
    // The title should come from one of the available labels (en or tr), not crash
    expect(doc.info.title).toMatch(/Label Test|Etiket Testi|label-test/);
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
