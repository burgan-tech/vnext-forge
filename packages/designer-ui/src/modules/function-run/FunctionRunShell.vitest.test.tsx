import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { useFunctionRunStore } from './store/functionRunStore.js';

vi.mock('../quick-run/pseudo-ui/PseudoUiOrJsonBlock', () => ({ PseudoUiOrJsonBlock: () => null }));
vi.mock('../quick-run/components/CopyableJsonBlock', () => ({
  CopyableJsonBlock: () => null, JsonEditorWithCopy: () => null,
}));
vi.mock('./FunctionRunApi', () => ({
  getInfo: vi.fn().mockResolvedValue({ success: true, data: { status: 200, contentType: 'application/json', responseHeaders: {}, body: '{}', json: {} } }),
  fetchContract: vi.fn(),
  invoke: vi.fn(),
}));

const { FunctionRunShell } = await import('./FunctionRunShell.js');

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(FunctionRunShell, { domain: 'core', functionKey: 'get-branches', scope: 'D', ...over } as never),
  );

/**
 * Finds the `<button>...</button>` block whose rendered text contains
 * `text`, and reports whether *that specific button* carries the boolean
 * `disabled` attribute.
 *
 * A bare `(html.match(/ disabled=""/g) ?? []).length > 0` check is vacuous
 * here: the "View" input-mode toggle is disabled independently of Invoke
 * (no input view before `/info` resolves), so it alone keeps that count
 * positive regardless of whether Invoke itself is ever disabled. Anchoring
 * on the Invoke button's own markup is what a mutation on `disabled={...}`
 * for just that button can actually be caught by.
 */
function isButtonDisabled(html: string, text: string): boolean {
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  const button = buttons.find((btn) => btn.includes(text));
  return button?.includes(' disabled=""') ?? false;
}

function isInvokeButtonDisabled(html: string): boolean {
  return isButtonDisabled(html, 'Invoke');
}

describe('FunctionRunShell', () => {
  it('asks for workflow and instance when the function is not domain-scoped', () => {
    const html = render({ scope: 'F' });
    expect(html).toContain('Workflow key');
    expect(html).toContain('Instance id');
  });

  it('does not ask for them for a domain-scoped function', () => {
    expect(render()).not.toContain('Instance id');
  });

  it('disables the Invoke button specifically before the contract has loaded, and says why', () => {
    // Effects have not run, so /info has not resolved — exactly the state a
    // user sees for the first moment, and it must not be a bare grey button.
    const html = render();
    expect(isInvokeButtonDisabled(html)).toBe(true);
    expect(html).toMatch(/contract/i);
  });

  it('shows a placeholder instead of an empty response column', () => {
    expect(render()).toMatch(/Invoke to run this function/i);
  });

  // I4 (whether the View toggle offers a mode it cannot actually render) is
  // tested in `functionRunOrchestration.vitest.test.ts` against
  // `computeInputViewAvailability` directly, not here. Seeding the store and
  // asserting on this file's rendered `html` cannot exercise it: zustand's
  // React binding feeds `useSyncExternalStore`'s SSR snapshot argument
  // `selector(api.getInitialState())` — frozen at store creation — so every
  // `useFunctionRunStore(...)` read in a `renderToStaticMarkup` render
  // reflects only that frozen snapshot, never anything seeded via `.set()`
  // beforehand. See `FunctionRunShell.tsx`'s mount-effect comment for the
  // same limitation applied to the identity-reset test below.

  it('does not surface a previous function\'s state when mounted fresh for a different function', () => {
    // C1: the store is a module-level singleton that outlives a genuine
    // unmount/remount for a *different* function. Simulate "function A ran
    // to completion" by seeding the store directly, then mount the shell as
    // if for function B — a real remount, since `render()` creates a brand
    // new component instance each call. `FunctionRunShell`'s mount-time
    // reset (a `useState` lazy initializer, not an effect, specifically so
    // this is observable here) must have cleared all of it before this
    // render reads the store.
    //
    // Asserted via `getState()`, not the rendered `html` — see the note
    // above and `FunctionRunShell.tsx`'s mount-effect comment: the SSR
    // snapshot zustand hands React is frozen at store creation, so `html`
    // here would show the same thing regardless of whether this fix exists.
    // `getState()` reads live state and is what actually proves the mount
    // handler ran and did its job.
    useFunctionRunStore.getState().set({
      info: {
        key: 'a', domain: 'core', version: '1.0.0', scope: 'D',
        function: { verbs: ['GET'], href: '/core/functions/a' },
      },
      response: {
        status: 200, contentType: 'application/json', responseHeaders: {},
        body: '{"marker":"FUNCTION_A_RESPONSE"}', json: { marker: 'FUNCTION_A_RESPONSE' },
      },
      workflowKey: 'wf-a',
      instanceId: 'inst-a',
      mode: 'view',
      verb: 'POST',
    });

    render({ functionKey: 'other-function' });

    const state = useFunctionRunStore.getState();
    expect(state.info).toBeNull();
    expect(state.response).toBeNull();
    expect(state.workflowKey).toBe('');
    expect(state.instanceId).toBe('');
    expect(state.mode).toBe('payload');
    expect(state.verb).toBeNull();
    expect(state.loadedIdentity).toBe('core::other-function');
  });
});
