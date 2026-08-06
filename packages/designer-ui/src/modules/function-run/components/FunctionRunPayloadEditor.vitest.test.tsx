import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Monaco does not run under this test setup (no jsdom); the JSON editor is
// rendered by CopyableJsonBlock's sibling export.
vi.mock('../../quick-run/components/CopyableJsonBlock', () => ({
  JsonEditorWithCopy: () => null,
  CopyableJsonBlock: () => null,
}));

const { FunctionRunPayloadEditor, shouldResyncFromValue, reconcileFormRows } = await import(
  './FunctionRunPayloadEditor.js'
);

const base = {
  contentType: 'json' as const,
  onContentTypeChange: () => undefined,
  value: {},
  onChange: () => undefined,
  schema: null,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunPayloadEditor, { ...base, ...over } as never));

describe('FunctionRunPayloadEditor', () => {
  it('offers both content types the proxy allows', () => {
    const html = render();
    expect(html).toContain('application/json');
    expect(html).toContain('application/x-www-form-urlencoded');
  });

  it('renders key/value rows for form-urlencoded', () => {
    expect(render({ contentType: 'form', value: { a: '1' } })).toContain('a');
  });

  it('encodes a nested value as JSON instead of "[object Object]"', () => {
    // Critical: `toFormRows` used to call `String(v)` on whatever the value
    // was; for an object that is `"[object Object]"`, and the first edit to
    // *any other* row would have committed that string back to the parent,
    // destroying the original nested value.
    const html = render({ contentType: 'form', value: { a: { b: 1 } } });
    expect(html).toContain('{&quot;b&quot;:1}');
    expect(html).not.toContain('[object Object]');
  });

  // Fix 2 removed the "GET and DELETE send no body — sent as query
  // parameters" note along with the `verb` prop: `FunctionRunInputPane` now
  // hides this editor entirely for a body-less verb instead of rendering it
  // with a relabeling hint, so this component no longer needs to know the
  // verb at all. The query-string input added by Fix 3 supersedes the note
  // (see `FunctionRunToolbar.vitest.test.tsx`).
  it('never mentions query parameters — that note moved to the dedicated query-string input', () => {
    expect(render()).not.toContain('query parameters');
  });
});

describe('shouldResyncFromValue', () => {
  it('does not strand: a later external reset still resyncs after a content-identical push', () => {
    // Reproduces the reported stranding sequence with a boolean-flag fix:
    //   1. parent holds {a:1}; editor mounts and syncs from null.
    //   2. user reformats to the same content; the field pushes it upstream.
    //   3. parent re-renders with a NEW object of IDENTICAL content — this
    //      must read as "our own echo", not "resync" (and, critically, must
    //      not depend on a flag that a subsequent no-op could leave stuck).
    //   4. user switches function; parent sets a genuinely different value —
    //      this MUST resync, which a stranded boolean flag would swallow.
    let lastPushed: string | null = null;

    const initialSerialized = JSON.stringify({ a: 1 }, null, 2);
    expect(shouldResyncFromValue(initialSerialized, lastPushed)).toBe(true);

    // Field parses the user's reformatted (but content-identical) text and
    // pushes the canonicalised result upstream.
    lastPushed = JSON.stringify({ a: 1 }, null, 2);

    // Parent echoes back a new object reference with the same content.
    const echoedSerialized = JSON.stringify({ a: 1 }, null, 2);
    expect(shouldResyncFromValue(echoedSerialized, lastPushed)).toBe(false);

    // A second content-identical echo must still read as "no resync" — this
    // is exactly what a one-shot boolean flag gets wrong the *second* time.
    expect(shouldResyncFromValue(echoedSerialized, lastPushed)).toBe(false);

    // Genuine external reset: a different function's payload.
    const externalSerialized = JSON.stringify({ b: 2 }, null, 2);
    expect(shouldResyncFromValue(externalSerialized, lastPushed)).toBe(true);
  });

  it('treats a null lastPushed (nothing pushed yet) as always needing a sync', () => {
    expect(shouldResyncFromValue(JSON.stringify({}), null)).toBe(true);
  });
});

describe('reconcileFormRows', () => {
  it('keeps the existing row id for an unchanged key so its input never remounts', () => {
    const prev = reconcileFormRows([], { a: '1' });
    const next = reconcileFormRows(prev, { a: '2', c: '3' });
    expect(next.find((r) => r.key === 'a')?.id).toBe(prev.find((r) => r.key === 'a')?.id);
    expect(next.find((r) => r.key === 'a')?.value).toBe('2');
    expect(next.find((r) => r.key === 'c')?.id).toBeDefined();
    expect(next.find((r) => r.key === 'c')?.id).not.toBe(prev.find((r) => r.key === 'a')?.id);
  });

  it('encodes a nested object as JSON rather than "[object Object]"', () => {
    const rows = reconcileFormRows([], { a: { b: 1 } });
    expect(rows[0]?.value).toBe(JSON.stringify({ b: 1 }));
  });

  it('renders null/undefined as an empty string, matching the pre-fix behaviour', () => {
    const rows = reconcileFormRows([], { a: null, b: undefined });
    expect(rows.find((r) => r.key === 'a')?.value).toBe('');
    expect(rows.find((r) => r.key === 'b')?.value).toBe('');
  });
});
