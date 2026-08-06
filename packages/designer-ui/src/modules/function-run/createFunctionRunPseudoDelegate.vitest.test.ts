import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as FunctionRunApi from './FunctionRunApi';
import {
  buildFunctionUrnInvokePath,
  createFunctionRunPseudoDelegate,
  type FunctionRunDelegateParams,
} from './createFunctionRunPseudoDelegate';

vi.mock('./FunctionRunApi', () => ({
  invoke: vi.fn(),
  getInfo: vi.fn(),
  fetchContract: vi.fn(),
}));

vi.mock('../quick-run/pseudo-ui/resolveComponentFile', () => ({
  resolveComponentFile: vi.fn(),
}));

const { resolveComponentFile } = await import('../quick-run/pseudo-ui/resolveComponentFile');

function exchange(over: Partial<Record<string, unknown>> = {}) {
  return {
    status: 200,
    contentType: 'application/json',
    responseHeaders: {},
    body: '{}',
    ...over,
  };
}

const baseParams: FunctionRunDelegateParams = {
  domain: 'core',
  getHeaders: () => ({}),
  getRuntimeUrl: () => undefined,
  getBindingContext: () => ({ data: null, extensions: null }),
  onSubmit: vi.fn(),
};

describe('buildFunctionUrnInvokePath', () => {
  it('builds the domain-scoped (2-segment) route when flow/instance are absent', () => {
    expect(buildFunctionUrnInvokePath({ domain: 'core', function: 'get-branches' })).toBe(
      '/api/v1/core/functions/get-branches',
    );
  });

  it('builds the instance-scoped (4-segment) route when both flow and instance are present', () => {
    expect(
      buildFunctionUrnInvokePath({
        domain: 'core',
        function: 'get-branches',
        flow: 'onboarding',
        instance: 'inst-1',
      }),
    ).toBe('/api/v1/core/workflows/onboarding/instances/inst-1/functions/get-branches');
  });

  it('falls back to the domain-scoped route when only one of flow/instance is present', () => {
    expect(
      buildFunctionUrnInvokePath({ domain: 'core', function: 'get-branches', flow: 'onboarding' }),
    ).toBe('/api/v1/core/functions/get-branches');
    expect(
      buildFunctionUrnInvokePath({ domain: 'core', function: 'get-branches', instance: 'inst-1' }),
    ).toBe('/api/v1/core/functions/get-branches');
  });
});

describe('createFunctionRunPseudoDelegate — requestData', () => {
  beforeEach(() => {
    vi.mocked(FunctionRunApi.invoke).mockReset();
  });

  it('invokes the domain-scoped route for a 2-segment fn URN and returns the JSON body', async () => {
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({
      success: true,
      data: exchange({ json: [{ id: '1', name: 'Kadıköy' }] }),
    });

    const delegate = createFunctionRunPseudoDelegate(baseParams);
    const result = await delegate.requestData('urn:vnext:fn:core:get-branches');

    expect(FunctionRunApi.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v1/core/functions/get-branches', verb: 'GET' }),
    );
    expect(result).toEqual([{ id: '1', name: 'Kadıköy' }]);
  });

  it('invokes the instance-scoped route for a 4-segment fn URN', async () => {
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({
      success: true,
      data: exchange({ json: { ok: true } }),
    });

    const delegate = createFunctionRunPseudoDelegate(baseParams);
    await delegate.requestData('urn:vnext:fn:core:onboarding:inst-1:get-branches');

    expect(FunctionRunApi.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/v1/core/workflows/onboarding/instances/inst-1/functions/get-branches',
      }),
    );
  });

  it('sends a POST verb URN as a JSON body, not query params', async () => {
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({ success: true, data: exchange({ json: {} }) });

    const delegate = createFunctionRunPseudoDelegate(baseParams);
    await delegate.requestData('urn:vnext:fn:post:core:search-branches', { term: 'kad' });

    expect(FunctionRunApi.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        verb: 'POST',
        body: JSON.stringify({ term: 'kad' }),
        contentType: 'application/json',
        query: undefined,
      }),
    );
  });

  it('sends a GET verb URN\'s params as a query, not a body', async () => {
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({ success: true, data: exchange({ json: {} }) });

    const delegate = createFunctionRunPseudoDelegate(baseParams);
    await delegate.requestData('urn:vnext:fn:core:search-branches', { term: 'kad' });

    expect(FunctionRunApi.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'GET', query: { term: 'kad' }, body: undefined }),
    );
  });

  it('returns undefined and never calls invoke for a cross-domain URN', async () => {
    const delegate = createFunctionRunPseudoDelegate(baseParams);
    const result = await delegate.requestData('urn:vnext:fn:other-domain:get-branches');

    expect(result).toBeUndefined();
    expect(FunctionRunApi.invoke).not.toHaveBeenCalled();
  });

  it('returns undefined and never calls invoke for a non-function URN (flow-transition)', async () => {
    const delegate = createFunctionRunPseudoDelegate(baseParams);
    const result = await delegate.requestData('urn:vnext:flow:transition:core:onboarding:approve');

    expect(result).toBeUndefined();
    expect(FunctionRunApi.invoke).not.toHaveBeenCalled();
  });

  it('returns undefined for an unresolved ${...} binding rather than sending the literal placeholder', async () => {
    const delegate = createFunctionRunPseudoDelegate(baseParams);
    const result = await delegate.requestData('urn:vnext:fn:core:get-branches-${region}');

    expect(result).toBeUndefined();
    expect(FunctionRunApi.invoke).not.toHaveBeenCalled();
  });

  it('resolves a ${...} binding from formData before parsing the URN', async () => {
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({ success: true, data: exchange({ json: [] }) });
    const delegate = createFunctionRunPseudoDelegate({
      ...baseParams,
      getBindingContext: () => ({ data: null, extensions: null, formData: { region: 'ist' } }),
    });

    await delegate.requestData('urn:vnext:fn:core:get-branches-${region}');

    expect(FunctionRunApi.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v1/core/functions/get-branches-ist' }),
    );
  });

  it('returns undefined on a transport failure', async () => {
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({
      success: false,
      error: { code: 'API_UNKNOWN', message: 'network down', traceId: 't1' },
    });

    const delegate = createFunctionRunPseudoDelegate(baseParams);
    const result = await delegate.requestData('urn:vnext:fn:core:get-branches');

    expect(result).toBeUndefined();
  });

  it('returns undefined for a 403 even though the call resolved with success: true', async () => {
    // The documented hazard: `success: true` does not mean "it worked" —
    // `data.status` carries the real HTTP outcome.
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({
      success: true,
      data: exchange({ status: 403, json: { error: 'forbidden' } }),
    });

    const delegate = createFunctionRunPseudoDelegate(baseParams);
    const result = await delegate.requestData('urn:vnext:fn:core:get-branches');

    expect(result).toBeUndefined();
  });

  it('returns undefined when the response is not JSON', async () => {
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({
      success: true,
      data: exchange({ contentType: 'text/plain', body: 'plain text', json: undefined }),
    });

    const delegate = createFunctionRunPseudoDelegate(baseParams);
    const result = await delegate.requestData('urn:vnext:fn:core:get-branches');

    expect(result).toBeUndefined();
  });

  it('returns undefined instead of throwing when invoke itself rejects', async () => {
    vi.mocked(FunctionRunApi.invoke).mockRejectedValue(new Error('boom'));

    const delegate = createFunctionRunPseudoDelegate(baseParams);
    await expect(delegate.requestData('urn:vnext:fn:core:get-branches')).resolves.toBeUndefined();
  });

  it('uses the live getHeaders/getRuntimeUrl getters at call time, not at factory time', async () => {
    vi.mocked(FunctionRunApi.invoke).mockResolvedValue({ success: true, data: exchange({ json: {} }) });
    let headers = { Authorization: 'Bearer one' };
    const delegate = createFunctionRunPseudoDelegate({
      ...baseParams,
      getHeaders: () => headers,
      getRuntimeUrl: () => 'http://localhost:1',
    });

    headers = { Authorization: 'Bearer two' };
    await delegate.requestData('urn:vnext:fn:core:get-branches');

    expect(FunctionRunApi.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Authorization: 'Bearer two' }, runtimeUrl: 'http://localhost:1' }),
    );
  });
});

describe('createFunctionRunPseudoDelegate — loadComponent', () => {
  beforeEach(() => {
    vi.mocked(resolveComponentFile).mockReset();
  });

  it('returns an empty placeholder when no project is active', async () => {
    const delegate = createFunctionRunPseudoDelegate(baseParams);
    const result = await delegate.loadComponent('urn:vnext:res:view:core:some-view');

    expect(resolveComponentFile).not.toHaveBeenCalled();
    expect(result.view.view).toEqual({ type: 'Column' });
  });

  it('delegates to resolveComponentFile when a project is active', async () => {
    const resolved = {
      schema: { type: 'object' },
      view: { $schema: 's', dataSchema: '', view: { type: 'Column' } },
    };
    vi.mocked(resolveComponentFile).mockResolvedValue(resolved as never);

    const delegate = createFunctionRunPseudoDelegate({ ...baseParams, projectId: 'proj-1' });
    const result = await delegate.loadComponent('urn:vnext:res:view:core:some-view');

    expect(resolveComponentFile).toHaveBeenCalledWith({ projectId: 'proj-1', ref: 'urn:vnext:res:view:core:some-view' });
    expect(result).toBe(resolved);
  });

  it('falls back to the empty placeholder on a workspace miss', async () => {
    vi.mocked(resolveComponentFile).mockResolvedValue(null);
    const delegate = createFunctionRunPseudoDelegate({ ...baseParams, projectId: 'proj-1' });
    const result = await delegate.loadComponent('urn:vnext:res:view:core:missing');
    expect(result.view.view).toEqual({ type: 'Column' });
  });
});

describe('createFunctionRunPseudoDelegate — onAction', () => {
  it('routes "submit" to the shell\'s onSubmit callback', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const delegate = createFunctionRunPseudoDelegate({ ...baseParams, onSubmit });

    await delegate.onAction('submit', { a: 1 }, 'urn:vnext:fn:core:whatever');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not call onSubmit for the pre/post hook phases', async () => {
    const onSubmit = vi.fn();
    const delegate = createFunctionRunPseudoDelegate({ ...baseParams, onSubmit });

    await delegate.onAction('submit', {}, 'cmd', { phase: 'pre' } as never);
    await delegate.onAction('submit', {}, 'cmd', { phase: 'post' } as never);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('still calls onSubmit for the main phase', async () => {
    const onSubmit = vi.fn();
    const delegate = createFunctionRunPseudoDelegate({ ...baseParams, onSubmit });

    await delegate.onAction('submit', {}, 'cmd', { phase: 'main' } as never);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not call onSubmit for any other action verb', async () => {
    const onSubmit = vi.fn();
    const delegate = createFunctionRunPseudoDelegate({ ...baseParams, onSubmit });

    await delegate.onAction('dispatch', {}, 'urn:vnext:fn:core:other-fn');
    await delegate.onAction('reset', {}, undefined);
    await delegate.onAction('back', {}, undefined);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not let a throwing onSubmit escape the delegate boundary', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('invoke exploded'));
    const delegate = createFunctionRunPseudoDelegate({ ...baseParams, onSubmit });

    await expect(delegate.onAction('submit', {}, 'cmd')).resolves.toBeUndefined();
  });
});
