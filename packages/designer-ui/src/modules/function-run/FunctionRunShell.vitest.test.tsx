import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

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

const disabledCount = (html: string) => (html.match(/ disabled=""/g) ?? []).length;

describe('FunctionRunShell', () => {
  it('asks for workflow and instance when the function is not domain-scoped', () => {
    const html = render({ scope: 'F' });
    expect(html).toContain('Workflow key');
    expect(html).toContain('Instance id');
  });

  it('does not ask for them for a domain-scoped function', () => {
    expect(render()).not.toContain('Instance id');
  });

  it('disables Invoke before the contract has loaded, and says why', () => {
    // Effects have not run, so /info has not resolved — exactly the state a
    // user sees for the first moment, and it must not be a bare grey button.
    const html = render();
    expect(disabledCount(html)).toBeGreaterThan(0);
    expect(html).toMatch(/contract/i);
  });

  it('shows a placeholder instead of an empty response column', () => {
    expect(render()).toMatch(/Invoke to run this function/i);
  });
});
