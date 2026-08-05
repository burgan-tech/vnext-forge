import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../quick-run/pseudo-ui/PseudoUiOrJsonBlock', () => ({
  PseudoUiOrJsonBlock: () => null,
}));
vi.mock('../../quick-run/components/CopyableJsonBlock', () => ({
  JsonEditorWithCopy: () => null,
  CopyableJsonBlock: () => null,
}));

const { FunctionRunInputPane } = await import('./FunctionRunInputPane.js');

const base = {
  mode: 'payload' as const,
  onModeChange: () => {},
  hasInputView: false,
  inputView: null,
  onViewFormChange: () => {},
  payloadEditorProps: {
    contentType: 'json' as const, onContentTypeChange: () => {},
    value: {}, onChange: () => {}, schema: null, verb: 'POST' as const,
  },
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunInputPane, { ...base, ...over } as never));

describe('FunctionRunInputPane', () => {
  it('always offers the Payload mode, even when a view exists', () => {
    // Free input must never be taken away — the whole point of the toggle.
    const html = render({ hasInputView: true, mode: 'view' });
    expect(html).toContain('Payload');
    expect(html).not.toMatch(/Payload<\/button>[^]*?disabled/);
  });

  it('disables the View mode with a reason when the contract declares none', () => {
    const html = render({ hasInputView: false });
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain('declares no input view');
  });

  it('marks the active mode for assistive technology', () => {
    expect(render({ mode: 'payload' })).toContain('aria-checked="true"');
  });
});
