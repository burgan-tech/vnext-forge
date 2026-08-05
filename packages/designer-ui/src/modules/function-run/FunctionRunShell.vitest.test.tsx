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

// Not mocked: `areToolHeadersHostOwned` (`../../app/ToolHeadersSync.js`)
// already guards `typeof window === 'undefined'` — the exact condition this
// package's Node-only test environment is always in — and returns `false`
// there, so every render below sees `toolWideHeadersHostOwned: false` with
// no mock needed. `resolveOpenHeadersAction`'s own tests below exercise the
// `true` branch directly, as a pure function, instead — see that describe
// block's comment for why a render-level end-to-end test of the `true`
// branch is not possible under this harness at all.
const { FunctionRunShell, resolveOpenHeadersAction } = await import('./FunctionRunShell.js');

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(FunctionRunShell, { domain: 'core', functionKey: 'get-branches', scope: 'D', ...over } as never),
  );

/**
 * Finds the `<button>...</button>` block for the primary Send action —
 * matching its text in both the ready state (`Send`) and in flight
 * (`Invoking…`) — and reports whether *that specific button* carries the
 * boolean `disabled` attribute.
 *
 * A bare `(html.match(/ disabled=""/g) ?? []).length > 0` check is vacuous
 * here: the "View" input-mode toggle is disabled independently of Send (no
 * input view before `/info` resolves), so it alone keeps that count positive
 * regardless of whether Send itself is ever disabled. Anchoring on Send's
 * own markup is what a mutation on `disabled={...}` for just that button can
 * actually be caught by.
 */
function isInvokeButtonDisabled(html: string): boolean {
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  const button = buttons.find((btn) => btn.includes('Send') || btn.includes('Invoking'));
  return button?.includes(' disabled=""') ?? false;
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
    expect(render()).toMatch(/Send to run this function/i);
  });

  it('shows the endpoint bar with the domain-scoped fallback route before /info loads', () => {
    // No `/info` response yet at first render (effects never run under
    // `renderToStaticMarkup`), so the endpoint bar must fall back to the
    // scope→route shape rather than sitting empty — see
    // `buildEndpointPreview`.
    expect(render()).toContain('/api/v1/core/functions/get-branches');
  });

  it('shows the Params and Headers request tabs, with Body hidden before /info resolves a body-bearing verb', () => {
    // No `/info` response yet at first render, so `verb` is still `null` and
    // `effectiveVerb` falls back to `GET` — a body-less verb, so the Body
    // tab must not exist at all yet (see `resolveEffectiveRequestTab` /
    // `FunctionRunRequestTabs`), even though the store's own default
    // `activeRequestTab` is `'body'`.
    const html = render();
    expect(html).toContain('>Params<');
    expect(html).toContain('>Headers<');
    expect(html).not.toContain('>Body<');
  });

  it('actually mounts the Params tab content on first render — not left with no active tab', () => {
    // The store's default `activeRequestTab` is `'body'`, which does not
    // exist as a tab yet (see the test above). If the shell passed that raw
    // value straight to `FunctionRunRequestTabs` instead of resolving it
    // through `resolveEffectiveRequestTab` first, Radix would find no
    // trigger/content pair for `'body'` and mark *nothing* active — Params'
    // own content (unlike its trigger label, which renders unconditionally)
    // would then be missing too. Content-specific text, not the trigger
    // label, is what actually distinguishes "resolved" from "unresolved"
    // here.
    expect(render()).toContain('Query parameters sent with every request');
  });

  it('does not render a maximize control for the standalone surface', () => {
    // `ScriptPanelResizeContext` is only ever provided by
    // `FlowEditorCanvasAndScriptResizableColumn`, which this test does not
    // render inside of — so `surface: 'panel'` (the default) still shows no
    // control here either. This asserts the *standalone* case explicitly so
    // a future change that starts rendering the control unconditionally
    // (ignoring the context) gets caught.
    const html = render({ surface: 'standalone' });
    expect(html).not.toContain('aria-label="Maximize"');
    expect(html).not.toContain('aria-label="Restore"');
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
      activeRequestTab: 'headers',
    });

    render({ functionKey: 'other-function' });

    const state = useFunctionRunStore.getState();
    expect(state.info).toBeNull();
    expect(state.response).toBeNull();
    expect(state.workflowKey).toBe('');
    expect(state.instanceId).toBe('');
    expect(state.mode).toBe('payload');
    expect(state.verb).toBeNull();
    // Request-tabs task (section 2): `activeRequestTab` is a store field
    // added after this test was first written — pinned here so a future
    // field added without updating `createInitialState()` fails loudly
    // instead of silently leaking one function's tab choice into the next.
    expect(state.activeRequestTab).toBe('body');
    expect(state.loadedIdentity).toBe('core::other-function');
  });
});

describe('resolveOpenHeadersAction', () => {
  // A render-level, end-to-end test of this wiring (seed the store, assert
  // the Headers tab's HTML differs) is not possible here, and not just
  // inconvenient: `useFunctionRunStore`'s React binding feeds
  // `useSyncExternalStore`'s SSR snapshot argument `selector(api.getInitialState())`
  // — the state as it was at *store creation*, frozen forever (see this
  // file's other tests and `FunctionRunShell.tsx`'s own mount-effect
  // comment) — so no `.set()` call made from a test can ever change what a
  // `renderToStaticMarkup` render of this component sees, for *any* field,
  // including `activeRequestTab`. Radix also does not mount an inactive
  // `TabsContent`'s children at all (verified against this package's own
  // harness — see `FunctionRunRequestTabs.vitest.test.tsx`), and the frozen
  // initial `activeRequestTab` never resolves to `'headers'` on first
  // render, so `FunctionRunHeadersTab`'s function body — and therefore
  // `toolWideHeadersHostOwned`'s effect on it — can never execute inside a
  // `FunctionRunShell` render at all. That logic is already covered
  // directly: `FunctionRunHeadersTab.vitest.test.tsx`'s host-owned describe
  // block asserts the rendering both ways, and the two tests below assert
  // the decision `handleOpenHeaders` delegates to. Between the two, the
  // only untested seam is three lines of prop-threading in
  // `FunctionRunShell.tsx` (`toolWideHeadersHostOwned={toolWideHeadersHostOwned}`,
  // `onOpenHeaders={handleOpenHeaders}`), which `tsc` already guards: an
  // omitted or mistyped prop there is a compile error, not a silent gap.
  it('switches to the Headers tab when the Forge-wide set is host-owned', () => {
    // Host-owned (the extension): `HeadersConfigDialog` cannot actually
    // save — the host overwrites `useToolHeadersStore` from its own
    // injected value on every panel open — so this must not route there.
    expect(resolveOpenHeadersAction(true)).toBe('switch-to-headers-tab');
  });

  it('opens the dialog when the Forge-wide set is not host-owned', () => {
    // Not host-owned (the web shell): the persisted store IS the truth, so
    // the previous, pre-fix behaviour is still correct.
    expect(resolveOpenHeadersAction(false)).toBe('open-dialog');
  });
});
