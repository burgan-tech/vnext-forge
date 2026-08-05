import { describe, expect, it } from 'vitest';

import { computeInvokeGate, readInfoExchange } from './functionRunOrchestration';

const exchange = (over: Partial<Record<string, unknown>> = {}) => ({
  status: 200, contentType: 'application/json', responseHeaders: {}, body: '{}', ...over,
}) as never;

const INFO = {
  key: 'get-branches', domain: 'core', version: '1.0.0', scope: 'D',
  function: { verbs: ['GET'], href: '/core/functions/get-branches' },
};

describe('readInfoExchange', () => {
  it('parses a 200 into info', () => {
    const result = readInfoExchange(exchange({ json: INFO }));
    expect(result.info).toEqual(INFO);
    expect(result.error).toBeNull();
  });

  it('explains a 404 as a missing component, not a failure', () => {
    // Built-in system functions (state, view, data…) have no sys-functions
    // component and legitimately 404 from /info.
    const result = readInfoExchange(exchange({ status: 404, json: {} }));
    expect(result.info).toBeNull();
    expect(result.error).toMatch(/no sys-functions component/i);
  });

  it('explains a 403 as a permissions problem', () => {
    const result = readInfoExchange(exchange({ status: 403, json: { detail: 'forbidden' } }));
    expect(result.info).toBeNull();
    expect(result.error).toMatch(/not allowed/i);
  });

  it('reports any other non-2xx with its status', () => {
    const result = readInfoExchange(exchange({ status: 500, body: 'boom', contentType: 'text/plain' }));
    expect(result.info).toBeNull();
    expect(result.error).toContain('500');
  });

  it('reports a 200 whose body is not a usable info payload', () => {
    // A 200 that does not carry `function.href` cannot drive the runner.
    expect(readInfoExchange(exchange({ json: { key: 'x' } })).error).toMatch(/could not be read/i);
    expect(readInfoExchange(exchange({ body: 'not json', jsonParseError: 'x' })).error).toMatch(/could not be read/i);
  });
});

describe('computeInvokeGate', () => {
  it('allows a domain-scoped function as soon as info is loaded', () => {
    expect(computeInvokeGate({ info: INFO as never, scope: 'D', workflowKey: '', instanceId: '' }))
      .toEqual({ canInvoke: true, reason: null });
  });

  it('blocks before info has loaded, and says why', () => {
    const gate = computeInvokeGate({ info: null, scope: 'D', workflowKey: '', instanceId: '' });
    expect(gate.canInvoke).toBe(false);
    expect(gate.reason).toMatch(/contract/i);
  });

  it('names the missing field for F and I scopes', () => {
    for (const scope of ['F', 'I'] as const) {
      expect(computeInvokeGate({ info: INFO as never, scope, workflowKey: '', instanceId: 'i' }).reason)
        .toMatch(/workflow key/i);
      expect(computeInvokeGate({ info: INFO as never, scope, workflowKey: 'w', instanceId: '' }).reason)
        .toMatch(/instance id/i);
      expect(computeInvokeGate({ info: INFO as never, scope, workflowKey: 'w', instanceId: 'i' }))
        .toEqual({ canInvoke: true, reason: null });
    }
  });

  it('treats whitespace-only scope ids as missing', () => {
    expect(computeInvokeGate({ info: INFO as never, scope: 'F', workflowKey: '  ', instanceId: 'i' }).canInvoke)
      .toBe(false);
  });
});
