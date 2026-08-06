import type { ApiResponse } from '@vnext-forge-studio/app-contracts';
import { describe, expect, it, vi } from 'vitest';

import { buildInvokeRequest } from './functionRunPayload';
import {
  computeInputViewAvailability,
  computeInvokeGate,
  loadFunctionInfo,
  readInfoExchange,
  runInvoke,
  type RunInfoApi,
  type RunInvokeApi,
} from './functionRunOrchestration';
import type { FunctionExchange, FunctionInfo } from './types/functionRun.types';

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
    expect(result.isAuthorizationError).toBe(false);
  });

  it('explains a 404 as a missing component, not a failure', () => {
    // Built-in system functions (state, view, data…) have no sys-functions
    // component and legitimately 404 from /info.
    const result = readInfoExchange(exchange({ status: 404, json: {} }));
    expect(result.info).toBeNull();
    expect(result.error).toMatch(/no sys-functions component/i);
    expect(result.isAuthorizationError).toBe(false);
  });

  it('explains a 403 as a permissions problem and points at Headers + Retry', () => {
    const result = readInfoExchange(exchange({ status: 403, json: { detail: 'forbidden' } }));
    expect(result.info).toBeNull();
    expect(result.error).toMatch(/not allowed/i);
    expect(result.error).toMatch(/headers/i);
    expect(result.error).toMatch(/retry/i);
    expect(result.isAuthorizationError).toBe(true);
  });

  it('flags a 401 the same way as a 403', () => {
    const result = readInfoExchange(exchange({ status: 401, json: {} }));
    expect(result.isAuthorizationError).toBe(true);
  });

  it('reports any other non-2xx with its status', () => {
    const result = readInfoExchange(exchange({ status: 500, body: 'boom', contentType: 'text/plain' }));
    expect(result.info).toBeNull();
    expect(result.error).toContain('500');
    expect(result.isAuthorizationError).toBe(false);
  });

  it('reports a 200 whose body is not a usable info payload', () => {
    // A 200 that does not carry `function.href` cannot drive the runner.
    expect(readInfoExchange(exchange({ json: { key: 'x' } })).error).toMatch(/could not be read/i);
    expect(readInfoExchange(exchange({ body: 'not json', jsonParseError: 'x' })).error).toMatch(/could not be read/i);
  });
});

describe('computeInvokeGate', () => {
  it('allows a domain-scoped function as soon as info is loaded', () => {
    expect(computeInvokeGate({ info: INFO as never, infoError: null, scope: 'D', workflowKey: '', instanceId: '' }))
      .toEqual({ canInvoke: true, reason: null });
  });

  it('blocks before info has loaded, and says why', () => {
    const gate = computeInvokeGate({ info: null, infoError: null, scope: 'D', workflowKey: '', instanceId: '' });
    expect(gate.canInvoke).toBe(false);
    expect(gate.reason).toMatch(/contract/i);
  });

  it('names the missing field for F and I scopes', () => {
    for (const scope of ['F', 'I'] as const) {
      expect(computeInvokeGate({ info: INFO as never, infoError: null, scope, workflowKey: '', instanceId: 'i' }).reason)
        .toMatch(/workflow key/i);
      expect(computeInvokeGate({ info: INFO as never, infoError: null, scope, workflowKey: 'w', instanceId: '' }).reason)
        .toMatch(/instance id/i);
      expect(computeInvokeGate({ info: INFO as never, infoError: null, scope, workflowKey: 'w', instanceId: 'i' }))
        .toEqual({ canInvoke: true, reason: null });
    }
  });

  it('treats whitespace-only scope ids as missing', () => {
    expect(
      computeInvokeGate({ info: INFO as never, infoError: null, scope: 'F', workflowKey: '  ', instanceId: 'i' })
        .canInvoke,
    ).toBe(false);
  });

  it('does not say "waiting" once /info has permanently failed', () => {
    // I7: a 404/403/500 will never resolve on its own — the reason next to
    // Invoke must not sit beside the error banner implying a load is still
    // in progress.
    const gate = computeInvokeGate({
      info: null,
      infoError: 'This function key has no sys-functions component.',
      scope: 'D',
      workflowKey: '',
      instanceId: '',
    });
    expect(gate.canInvoke).toBe(false);
    expect(gate.reason).not.toMatch(/waiting/i);
  });
});

describe('computeInputViewAvailability', () => {
  it('has nothing to show before info has loaded', () => {
    expect(computeInputViewAvailability({ info: null, inputViewContent: null }))
      .toEqual({ hasUsableInputView: false, declaredButUnavailable: false });
  });

  it('is usable once the adapted view content has arrived', () => {
    expect(
      computeInputViewAvailability({
        info: { inputView: { hasView: true, href: '/x' } },
        inputViewContent: { key: 'v', type: 't', content: {} },
      }),
    ).toEqual({ hasUsableInputView: true, declaredButUnavailable: false });
  });

  it('says so when /info declares a view the fetch could not fill', () => {
    // I4: `hasView: true` alone does not mean there is anything to render —
    // the view fetch can still 404 or return something unparseable, leaving
    // `inputViewContent` null despite the flag.
    expect(
      computeInputViewAvailability({
        info: { inputView: { hasView: true, href: '/x' } },
        inputViewContent: null,
      }),
    ).toEqual({ hasUsableInputView: false, declaredButUnavailable: true });
  });

  it('is simply unavailable, not "declared but unavailable", when no view was ever declared', () => {
    expect(computeInputViewAvailability({ info: { inputView: undefined }, inputViewContent: null }))
      .toEqual({ hasUsableInputView: false, declaredButUnavailable: false });
  });
});

// ---------------------------------------------------------------------------
// Async sequencing — loadFunctionInfo / runInvoke
//
// These exist as plain, dependency-injected functions specifically so this
// interleaving can be controlled and observed directly: this package has no
// jsdom and `renderToStaticMarkup` never runs effects, so a real race
// between two overlapping fetches cannot be reproduced by rendering the
// shell at all.
// ---------------------------------------------------------------------------

/** A promise plus its resolver, so a test can decide exactly when it settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function okExchange(over: Partial<FunctionExchange> = {}): ApiResponse<FunctionExchange> {
  return {
    success: true,
    data: { status: 200, contentType: 'application/json', responseHeaders: {}, body: '{}', ...over },
  } as ApiResponse<FunctionExchange>;
}

function infoExchange(info: FunctionInfo): ApiResponse<FunctionExchange> {
  return okExchange({ json: info as unknown as Record<string, unknown> });
}

const INFO_WITH_VIEW: FunctionInfo = {
  ...(INFO as FunctionInfo),
  inputView: { hasView: true, href: '/core/functions/get-branches/input-view' },
};

describe('loadFunctionInfo — contract fetch anchors', () => {
  it("passes the engine's own domain alongside each href, so the host can strip the gateway prefix", async () => {
    // The exact `/info` payload from the field report: gateway-prefixed
    // hrefs. The host rebases them with `rebaseRuntimeHref`, which needs the
    // domain as its anchor — sending the href alone is what produced
    // `/api/v1/api/core/…` and the "input view could not be loaded" error.
    const gatewayInfo: FunctionInfo = {
      key: 'get-branches-func',
      domain: 'core',
      version: '1.0.0',
      scope: 'D',
      function: { verbs: [], href: '/api/core/functions/get-branches-func' },
      inputView: {
        hasView: true,
        loadData: false,
        href: '/api/core/functions/get-branches-func/view?target=input',
      },
    };
    const fetchContract = vi.fn().mockResolvedValue(
      okExchange({ body: '{"key":"v","type":"t","content":{}}', json: { key: 'v', type: 't', content: {} } }),
    );

    await loadFunctionInfo({
      domain: 'core', functionKey: 'get-branches-func', scope: 'D', workflowKey: '', instanceId: '',
      headers: {}, runtimeUrl: undefined,
      isCancelled: () => false,
      set: () => undefined,
      api: { getInfo: () => Promise.resolve(infoExchange(gatewayInfo)), fetchContract },
    });

    expect(fetchContract).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/core/functions/get-branches-func/view?target=input',
        domain: 'core',
      }),
    );
  });
});

describe('loadFunctionInfo — input view loading', () => {
  it('flags the view fetch as loading and clears it when the fetch lands', async () => {
    // The input-view section is visible from the moment `/info` declares a
    // view, and `infoLoading` is already false by then. Without this flag the
    // section spends the whole fetch showing its "could not be loaded" error,
    // because a declared view with no content yet is indistinguishable from a
    // failed one — see `computeInputViewAvailability`.
    const viewRes = deferred<ApiResponse<FunctionExchange>>();
    const setCalls: Record<string, unknown>[] = [];

    const call = loadFunctionInfo({
      domain: 'core', functionKey: 'get-branches', scope: 'D', workflowKey: '', instanceId: '',
      headers: {}, runtimeUrl: undefined,
      isCancelled: () => false,
      set: (patch) => setCalls.push(patch),
      api: {
        getInfo: () => Promise.resolve(infoExchange(INFO_WITH_VIEW)),
        fetchContract: () => viewRes.promise,
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(setCalls.some((p) => p.inputViewLoading === true)).toBe(true);
    expect(setCalls.some((p) => p.inputViewLoading === false)).toBe(false);

    viewRes.resolve(
      okExchange({ body: '{"key":"v","type":"t","content":{}}', json: { key: 'v', type: 't', content: {} } }),
    );
    await call;

    expect(setCalls.some((p) => p.inputViewLoading === false)).toBe(true);
    expect(setCalls.some((p) => 'inputViewContent' in p)).toBe(true);
  });

  it('clears the loading flag on a failed view fetch, rather than stranding a spinner', async () => {
    const setCalls: Record<string, unknown>[] = [];

    await loadFunctionInfo({
      domain: 'core', functionKey: 'get-branches', scope: 'D', workflowKey: '', instanceId: '',
      headers: {}, runtimeUrl: undefined,
      isCancelled: () => false,
      set: (patch) => setCalls.push(patch),
      api: {
        getInfo: () => Promise.resolve(infoExchange(INFO_WITH_VIEW)),
        fetchContract: () =>
          Promise.resolve({
            success: false,
            error: { code: 'RUNTIME_CONNECTION_FAILED', message: 'nope' },
          } as ApiResponse<FunctionExchange>),
      },
    });

    expect(setCalls.some((p) => p.inputViewLoading === false)).toBe(true);
    // Nothing usable arrived, so the section falls through to its declared-
    // but-unavailable error — which requires `inputViewContent` untouched.
    expect(setCalls.some((p) => 'inputViewContent' in p)).toBe(false);
  });
});

describe('loadFunctionInfo', () => {
  it('does not write the input view once cancelled, even if its fetch resolves later', async () => {
    const infoRes = deferred<ApiResponse<FunctionExchange>>();
    const viewRes = deferred<ApiResponse<FunctionExchange>>();
    const setCalls: Record<string, unknown>[] = [];
    let cancelled = false;

    const api: RunInfoApi = {
      getInfo: () => infoRes.promise,
      fetchContract: () => viewRes.promise,
    };

    const call = loadFunctionInfo({
      domain: 'core', functionKey: 'get-branches', scope: 'D', workflowKey: '', instanceId: '',
      headers: {}, runtimeUrl: undefined,
      isCancelled: () => cancelled,
      set: (patch) => setCalls.push(patch),
      api,
    });

    infoRes.resolve(infoExchange(INFO_WITH_VIEW));
    // Let the microtask chain advance past `/info`'s `.then` up to the point
    // where the input-view fetch has been started (but not resolved).
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    cancelled = true; // simulates the effect's cleanup firing (unmount / identity change)
    viewRes.resolve(okExchange({ body: '{"key":"v","type":"t","content":{}}', json: { key: 'v', type: 't', content: {} } }));
    await call;

    expect(setCalls.some((p) => 'inputViewContent' in p)).toBe(false);
  });

  it('a stale call cannot overwrite a newer call even if its /info resolves later', async () => {
    const staleInfoRes = deferred<ApiResponse<FunctionExchange>>();
    const setCalls: Record<string, unknown>[] = [];
    let staleCancelled = false;

    const staleApi: RunInfoApi = { getInfo: () => staleInfoRes.promise, fetchContract: vi.fn() };
    const staleCall = loadFunctionInfo({
      domain: 'core', functionKey: 'a', scope: 'D', workflowKey: '', instanceId: '',
      headers: {}, runtimeUrl: undefined,
      isCancelled: () => staleCancelled,
      set: (patch) => setCalls.push(patch),
      api: staleApi,
    });

    // The real effect's cleanup marks the previous cycle cancelled before
    // starting the next one — do that, then run cycle 2 to completion.
    staleCancelled = true;
    const freshInfo: FunctionInfo = { ...(INFO as FunctionInfo), key: 'b' };
    const freshApi: RunInfoApi = { getInfo: () => Promise.resolve(infoExchange(freshInfo)), fetchContract: vi.fn() };
    await loadFunctionInfo({
      domain: 'core', functionKey: 'b', scope: 'D', workflowKey: '', instanceId: '',
      headers: {}, runtimeUrl: undefined,
      isCancelled: () => false,
      set: (patch) => setCalls.push(patch),
      api: freshApi,
    });

    setCalls.length = 0; // only observe what happens when the stale cycle's /info finally lands
    staleInfoRes.resolve(infoExchange(INFO as FunctionInfo));
    await staleCall;

    expect(setCalls).toHaveLength(0);
  });

  it('sets a default verb and infoError null on a clean load', async () => {
    const setCalls: Record<string, unknown>[] = [];
    const api: RunInfoApi = { getInfo: () => Promise.resolve(infoExchange(INFO as FunctionInfo)), fetchContract: vi.fn() };
    await loadFunctionInfo({
      domain: 'core', functionKey: 'get-branches', scope: 'D', workflowKey: '', instanceId: '',
      headers: {}, runtimeUrl: undefined, isCancelled: () => false,
      set: (patch) => setCalls.push(patch),
      api,
    });
    expect(setCalls).toContainEqual({ verb: 'GET' });
    expect(setCalls.some((p) => p.infoError === null)).toBe(true);
  });

  it('prefers the transport error message over the generic fallback', async () => {
    const setCalls: Record<string, unknown>[] = [];
    const api: RunInfoApi = {
      getInfo: () =>
        Promise.resolve({
          success: false,
          data: null,
          error: { code: 'API_UNKNOWN', message: 'instanceId is not a valid path segment.' },
        } as ApiResponse<FunctionExchange>),
      fetchContract: vi.fn(),
    };
    await loadFunctionInfo({
      domain: 'core', functionKey: 'get-branches', scope: 'I', workflowKey: 'w', instanceId: 'bad id',
      headers: {}, runtimeUrl: undefined, isCancelled: () => false,
      set: (patch) => setCalls.push(patch),
      api,
    });
    const failure = setCalls.find((p) => 'infoError' in p && p.infoError);
    expect(failure?.infoError).toBe('instanceId is not a valid path segment.');
    // A transport failure never reached `readInfoExchange` — it must not be
    // reported as an authorization problem regardless of what headers are set.
    expect(failure?.infoErrorIsAuthorization).toBe(false);
  });

  it('reports a 403 on /info as an authorization failure so the shell can offer Headers + Retry', async () => {
    // I1 (fix 1): the shell must not have to string-match `infoError` to
    // learn this — `loadFunctionInfo` threads `readInfoExchange`'s
    // discriminator straight into the store patch.
    const setCalls: Record<string, unknown>[] = [];
    const api: RunInfoApi = {
      getInfo: () =>
        Promise.resolve({
          success: true,
          data: { status: 403, contentType: 'application/json', responseHeaders: {}, body: '{}', json: {} },
        } as ApiResponse<FunctionExchange>),
      fetchContract: vi.fn(),
    };
    await loadFunctionInfo({
      domain: 'core', functionKey: 'get-branches', scope: 'D', workflowKey: '', instanceId: '',
      headers: {}, runtimeUrl: undefined, isCancelled: () => false,
      set: (patch) => setCalls.push(patch),
      api,
    });
    const failure = setCalls.find((p) => 'infoError' in p && p.infoError);
    expect(failure?.infoErrorIsAuthorization).toBe(true);
  });
});

describe('runInvoke', () => {
  it('surfaces a transport failure instead of silently leaving the previous response on screen', async () => {
    const setCalls: Record<string, unknown>[] = [];
    const api: RunInvokeApi = {
      invoke: () =>
        Promise.resolve({
          success: false,
          data: null,
          error: { code: 'API_UNKNOWN', message: 'Could not reach host X' },
        } as ApiResponse<FunctionExchange>),
      fetchContract: vi.fn(),
    };

    await runInvoke({
      info: INFO as FunctionInfo,
      verb: 'GET',
      mode: 'payload',
      viewFormData: {},
      payload: {},
      contentType: 'json',
      queryString: '',
      headers: {},
      runtimeUrl: undefined,
      buildInvokeRequest,
      set: (patch) => setCalls.push(patch),
      api,
    });

    const failure = setCalls.find((p) => 'invokeError' in p && p.invokeError);
    expect(failure?.invokeError).toBe('Could not reach host X');
    // The previous `response` must never be touched by a transport failure —
    // a stale success must not be re-presented as this attempt's outcome.
    expect(setCalls.some((p) => 'response' in p)).toBe(false);
  });

  it('clears any previous invokeError on a fresh attempt, before the network call resolves', async () => {
    const setCalls: Record<string, unknown>[] = [];
    const api: RunInvokeApi = { invoke: () => Promise.resolve(okExchange()), fetchContract: vi.fn() };
    await runInvoke({
      info: INFO as FunctionInfo, verb: 'GET', mode: 'payload', viewFormData: {}, payload: {}, contentType: 'json',
      queryString: '',
      headers: {}, runtimeUrl: undefined, buildInvokeRequest,
      set: (patch) => setCalls.push(patch),
      api,
    });
    expect(setCalls[0]).toEqual({ invoking: true, invokeError: null });
  });

  it('threads the query-string input through buildInvokeRequest into the actual invoke call', async () => {
    // Fix 3: the query-string input must reach the wire, not just live in
    // the store — this exercises the real `buildInvokeRequest`, not a mock,
    // so a regression in how `runInvoke` forwards `queryString` would show
    // up here even if `functionRunPayload.vitest.test.ts` still passes.
    const invokeMock = vi.fn().mockResolvedValue(okExchange());
    const api: RunInvokeApi = { invoke: invokeMock, fetchContract: vi.fn() };
    await runInvoke({
      info: INFO as FunctionInfo,
      verb: 'GET',
      mode: 'payload',
      viewFormData: {},
      payload: {},
      contentType: 'json',
      queryString: 'a=1',
      headers: {},
      runtimeUrl: undefined,
      buildInvokeRequest,
      set: () => undefined,
      api,
    });
    expect(invokeMock).toHaveBeenCalledWith(expect.objectContaining({ query: { a: '1' } }));
  });
});
