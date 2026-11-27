import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DynamicExpressoField } from './DynamicExpressoField.js';

describe('DynamicExpressoField', () => {
  it('renders the label, hint and current expression code', () => {
    const html = renderToStaticMarkup(
      createElement(DynamicExpressoField, {
        label: 'Key Expression',
        hint: 'Dynamic Expresso expression.',
        value: { location: 'dynamicExpresso', code: 'a + b', encoding: 'NAT' },
        onChange: () => {},
      }),
    );
    expect(html).toContain('Key Expression');
    expect(html).toContain('Dynamic Expresso expression.');
    expect(html).toContain('a + b');
  });

  it('renders an empty textarea when value is undefined', () => {
    const html = renderToStaticMarkup(
      createElement(DynamicExpressoField, { label: 'Key Expression', value: undefined, onChange: () => {} }),
    );
    expect(html).toContain('Key Expression');
    expect(html).toContain('data-testid="expression-mirror"');
    expect(html).toContain('<textarea');
  });

  it('highlights through the mirror on the key surface', () => {
    const html = renderToStaticMarkup(
      createElement(DynamicExpressoField, {
        label: 'Key Expression',
        value: { location: 'dynamicExpresso', code: 'sha256(1)', encoding: 'NAT' },
        onChange: () => {},
      }),
    );
    expect(html).toContain('data-testid="expression-mirror"');
  });

  it('keeps the saved shape and collapses empty text to undefined', () => {
    const calls: unknown[] = [];
    const el = DynamicExpressoField({ label: 'K', value: undefined, onChange: (v) => calls.push(v) }) as any;
    const textarea = el.props.children;
    textarea.props.onChange('a + b');
    textarea.props.onChange('');
    expect(calls).toEqual([{ location: 'dynamicExpresso', code: 'a + b', encoding: 'NAT' }, undefined]);
  });
});
