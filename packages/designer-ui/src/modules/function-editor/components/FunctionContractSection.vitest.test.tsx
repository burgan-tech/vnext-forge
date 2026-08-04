/**
 * The card renders unconditionally — Forge offers the current contract whatever
 * the project pins.
 *
 * The regression these tests exist to catch is re-introducing a schema gate on
 * visibility: Forge's own bundled pin (^0.0.39) declares none of these fields, so
 * any such gate hides fields Forge fully implements. Nothing here mocks a schema,
 * because the card no longer consults one.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * The "open in modal" affordance pulls in ComponentEditorModalContext →
 * ComponentEditorDialog → ViewEditorView → @burgan-tech/pseudo-ui, which does a
 * directory import of `primereact/api` that Node's ESM resolver rejects. It is
 * irrelevant to these assertions, so stub it rather than dragging the whole
 * editor graph in.
 */
vi.mock('../../save-component/components/OpenVnextComponentInModalButton.js', () => ({
  OpenVnextComponentInModalButton: () => null,
}));

const { FunctionContractSection } = await import('./FunctionContractSection.js');

function render(json: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(FunctionContractSection, { json, onChange: () => {} }),
  );
}

describe('FunctionContractSection — always offers the current contract', () => {
  it('renders every contract field regardless of any schema', () => {
    // The regression guard. Forge's editors are the authority on what Forge
    // supports; gating this on a schema hid fields Forge fully implements.
    const html = render({ key: 'f', attributes: { scope: 'F', verbs: ['GET'] } });
    expect(html).toContain('Contract');
    expect(html).toContain('Verbs');
    expect(html).toContain('Input Schema');
    expect(html).toContain('Output Schema');
    expect(html).toContain('Input View');
    expect(html).toContain('Output View');
  });

  it('renders the card for an empty function', () => {
    expect(render({ key: 'f', attributes: { scope: 'F' } })).toContain('Contract');
  });

  it('carries no schema-mismatch warning — that is reported once, at save time', () => {
    const html = render({ key: 'f', attributes: { scope: 'F', verbs: ['GET'] } });
    expect(html).not.toContain('does not define');
    expect(html).not.toContain('schemaVersion');
  });
});

describe('FunctionContractSection — card chrome', () => {
  it('starts collapsed when no contract value is set, and open when one is', () => {
    const collapsed = render({ key: 'f', attributes: { scope: 'F' } });
    expect(collapsed).toContain('Contract');
    expect(collapsed).toContain('Expand Contract section');
    expect(collapsed).not.toContain('Verbs');

    const expanded = render({ key: 'f', attributes: { scope: 'F', verbs: ['GET'] } });
    expect(expanded).toContain('Collapse Contract section');
    expect(expanded).toContain('Verbs');
  });
});

describe('FunctionContractSection — slot rendering', () => {
  it('renders a single reference slot with its component key', () => {
    const html = render({
      key: 'f',
      attributes: {
        scope: 'F',
        inputView: { key: 'approve-form', domain: 'lending', version: '2.0.0', flow: 'sys-views' },
      },
    });
    expect(html).toContain('approve-form');
    expect(html).toContain('@lending');
    expect(html).toContain('v2.0.0');
  });

  it('renders rule entries in order, marking the trailing rule-less one as fallback', () => {
    const html = render({
      key: 'f',
      attributes: {
        scope: 'F',
        outputView: [
          { rule: { location: './src/R.csx', code: 'Ly8=', encoding: 'B64' }, view: { key: 'rich', domain: 'd', version: '1.0.0', flow: 'sys-views' } },
          { view: { key: 'plain', domain: 'd', version: '1.0.0', flow: 'sys-views' } },
        ],
      },
    });
    expect(html).toContain('rich');
    expect(html).toContain('plain');
    expect(html).toContain('Fallback — always matches');
    expect(html.indexOf('rich')).toBeLessThan(html.indexOf('plain'));
  });

  it('warns when a rule-less entry shadows the entries after it', () => {
    const html = render({
      key: 'f',
      attributes: {
        scope: 'F',
        outputView: [
          { view: { key: 'always', domain: 'd', version: '1.0.0', flow: 'sys-views' } },
          { rule: { location: './src/R.csx', code: 'Ly8=', encoding: 'B64' }, view: { key: 'never', domain: 'd', version: '1.0.0', flow: 'sys-views' } },
        ],
      },
    });
    expect(html).toContain('shadows the entries below it');
  });

  it('reads the { views: [...] } wrapper wire shape', () => {
    const html = render({
      key: 'f',
      attributes: {
        scope: 'F',
        inputView: { views: [{ view: { key: 'wrapped', domain: 'd', version: '1.0.0', flow: 'sys-views' } }] },
      },
    });
    expect(html).toContain('wrapped');
  });

  it('shows a file reference read-only rather than pretending it is editable', () => {
    const html = render({
      key: 'f',
      attributes: { scope: 'F', inputSchema: { ref: './schemas/input.json' } },
    });
    expect(html).toContain('./schemas/input.json');
    expect(html).toContain('File reference');
  });

  it('refuses to interpret an unrecognized slot value and offers to clear it', () => {
    const html = render({ key: 'f', attributes: { scope: 'F', inputView: 'nonsense' } });
    expect(html).toContain('Unrecognized view contract');
    expect(html).toContain('Clear Input View');
  });
});
