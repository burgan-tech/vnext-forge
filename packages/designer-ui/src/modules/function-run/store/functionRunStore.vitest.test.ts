import { describe, expect, it } from 'vitest';

import { useFunctionRunStore } from './functionRunStore';

describe('functionRunStore reset', () => {
  it('gives payload/viewFormData a fresh object identity on every reset, never a shared reference', () => {
    useFunctionRunStore.getState().reset();
    const firstPayload = useFunctionRunStore.getState().payload;
    const firstViewFormData = useFunctionRunStore.getState().viewFormData;

    // Simulate an in-place mutation slipping past the store's own `set`
    // (e.g. a caller pushing into a nested array without cloning first).
    firstPayload.leaked = 'should not survive a reset';
    firstViewFormData.leaked = 'should not survive a reset';

    useFunctionRunStore.getState().reset();
    const secondPayload = useFunctionRunStore.getState().payload;
    const secondViewFormData = useFunctionRunStore.getState().viewFormData;

    expect(secondPayload).not.toBe(firstPayload);
    expect(secondViewFormData).not.toBe(firstViewFormData);
    expect(secondPayload).toEqual({});
    expect(secondViewFormData).toEqual({});
  });

  it('clears every field a previous function could have left behind, not only payload/viewFormData', () => {
    // C1: the store is a module-level singleton that survives a genuine
    // unmount/remount for a *different* function (see the store's own
    // singleton comment). `FunctionRunShell` relies on `reset()` clearing
    // everything below before it renders for a new function key — this
    // pins that `reset()` is actually fit for that purpose, field by field,
    // so a future field added to the store without updating
    // `createInitialState()` fails loudly here instead of silently leaking
    // one function's state into the next function's first render.
    useFunctionRunStore.getState().set({
      info: {
        key: 'a', domain: 'core', version: '1.0.0', scope: 'D',
        function: { verbs: ['GET'], href: '/core/functions/a' },
      },
      infoExchange: { status: 200, contentType: 'application/json', responseHeaders: {}, body: '{}' },
      infoLoading: true,
      infoError: 'some previous error',
      infoErrorIsAuthorization: true,
      verb: 'POST',
      mode: 'view',
      contentType: 'form',
      payload: { region: 'eu' },
      viewFormData: { region: 'eu' },
      queryString: 'a=1',
      workflowKey: 'wf-a',
      instanceId: 'inst-a',
      inputViewContent: { key: 'v', type: 't', content: {} },
      outputViewContent: { key: 'o', type: 't', content: {} },
      inputSchema: { type: 'object' },
      invoking: true,
      invokeError: 'previous invoke error',
      response: { status: 200, contentType: 'application/json', responseHeaders: {}, body: '{"ok":true}' },
      responseDurationMs: 123,
    });

    useFunctionRunStore.getState().reset();
    const state = useFunctionRunStore.getState();

    expect(state.info).toBeNull();
    expect(state.infoExchange).toBeNull();
    expect(state.infoLoading).toBe(false);
    expect(state.infoError).toBeNull();
    expect(state.infoErrorIsAuthorization).toBe(false);
    expect(state.verb).toBeNull();
    expect(state.mode).toBe('payload');
    expect(state.contentType).toBe('json');
    expect(state.payload).toEqual({});
    expect(state.viewFormData).toEqual({});
    expect(state.queryString).toBe('');
    expect(state.workflowKey).toBe('');
    expect(state.instanceId).toBe('');
    expect(state.inputViewContent).toBeNull();
    expect(state.outputViewContent).toBeNull();
    expect(state.inputSchema).toBeNull();
    expect(state.invoking).toBe(false);
    expect(state.invokeError).toBeNull();
    expect(state.response).toBeNull();
    expect(state.responseDurationMs).toBeNull();
    expect(state.loadedIdentity).toBeNull();
  });
});

describe('resetIfNewIdentity', () => {
  it('does not clear anything the first time an identity is ever recorded', () => {
    useFunctionRunStore.getState().reset();
    useFunctionRunStore.getState().set({ workflowKey: 'wf-a' });
    useFunctionRunStore.getState().resetIfNewIdentity('core::a');
    expect(useFunctionRunStore.getState().workflowKey).toBe('wf-a');
    expect(useFunctionRunStore.getState().loadedIdentity).toBe('core::a');
  });

  it('does not clear state for a re-render of the same identity', () => {
    useFunctionRunStore.getState().reset();
    useFunctionRunStore.getState().resetIfNewIdentity('core::a');
    useFunctionRunStore.getState().set({ workflowKey: 'wf-a', response: null });
    useFunctionRunStore.getState().resetIfNewIdentity('core::a');
    expect(useFunctionRunStore.getState().workflowKey).toBe('wf-a');
  });

  it('clears everything when the identity differs from what was last loaded', () => {
    useFunctionRunStore.getState().reset();
    useFunctionRunStore.getState().resetIfNewIdentity('core::a');
    useFunctionRunStore.getState().set({
      workflowKey: 'wf-a',
      mode: 'view',
      verb: 'POST',
      queryString: 'a=1',
      infoErrorIsAuthorization: true,
    });

    useFunctionRunStore.getState().resetIfNewIdentity('core::b');
    const state = useFunctionRunStore.getState();
    expect(state.workflowKey).toBe('');
    expect(state.mode).toBe('payload');
    expect(state.verb).toBeNull();
    expect(state.queryString).toBe('');
    expect(state.infoErrorIsAuthorization).toBe(false);
    expect(state.loadedIdentity).toBe('core::b');
  });
});
