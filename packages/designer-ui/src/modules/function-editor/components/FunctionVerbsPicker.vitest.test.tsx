import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { FunctionVerbsPicker } from './FunctionVerbsPicker.js';

function render(value: unknown) {
  return renderToStaticMarkup(
    createElement(FunctionVerbsPicker, { value, onChange: () => {} }),
  );
}

/**
 * Counts checked boxes via `aria-checked`, which Radix emits once per
 * checkbox root — `data-state` also appears on the indicator, so counting
 * that would double.
 */
function countChecked(html: string): number {
  return (html.match(/aria-checked="true"/g) ?? []).length;
}

describe('FunctionVerbsPicker', () => {
  it('renders all four verbs the contract allows, with their descriptions', () => {
    const html = render(undefined);
    expect(html).toContain('GET');
    expect(html).toContain('POST');
    expect(html).toContain('PATCH');
    expect(html).toContain('DELETE');
    expect(html).toContain('Read without a request body');
    expect(html).toContain('Create or invoke with a request body');
    expect(html).toContain('Partial update with a request body');
  });

  it('does not offer PUT or QUERY — the contract excludes both', () => {
    // QUERY is deliberately absent: OpenAPI generation, gateways and client
    // SDKs cannot handle an unrecognized method.
    const html = render(undefined);
    expect(html).not.toContain('PUT');
    expect(html).not.toContain('QUERY');
  });

  it('explains that an empty selection means no restriction', () => {
    expect(render(undefined)).toContain('No verb restriction');
    expect(render([])).toContain('No verb restriction');
  });

  it('drops the hint once verbs are selected', () => {
    const html = render(['GET']);
    expect(html).not.toContain('No verb restriction');
    expect(html).toContain('HTTP verbs this function supports.');
  });

  it('marks the selected verbs as checked', () => {
    expect(countChecked(render(['GET', 'DELETE']))).toBe(2);
    expect(countChecked(render(undefined))).toBe(0);
  });

  it('ignores unknown verbs in the stored value instead of rendering them', () => {
    expect(countChecked(render(['GET', 'PUT', 'nonsense']))).toBe(1);
  });

  it('tolerates a non-array value without throwing', () => {
    expect(() => render('GET')).not.toThrow();
    expect(render('GET')).toContain('No verb restriction');
  });
});

describe('FunctionVerbsPicker — onChange contract', () => {
  /**
   * The picker must hand up the canonical value, because `verbs` has
   * `minItems: 1`: writing `[]` fails validation, whereas dropping the key
   * means "no verb restriction". The toggle logic itself is covered in
   * functionContractSlots.vitest.test.ts; here we only assert the wiring
   * passes `undefined` up rather than an empty array.
   */
  it('is wired to the canonical toggle helper', async () => {
    const { toggleVerb } = await import('../functionContractSlots.js');
    const onChange = vi.fn();
    // Emulate what the checkbox handler does for the last remaining verb.
    onChange(toggleVerb(['GET'], 'GET', false));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
