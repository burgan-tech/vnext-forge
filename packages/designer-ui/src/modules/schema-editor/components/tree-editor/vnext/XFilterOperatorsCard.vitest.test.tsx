import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { FILTER_OPERATORS } from './filterOperators';
import { XFilterOperatorsCard } from './XFilterOperatorsCard';

function doc(operators: unknown[]): Record<string, unknown> {
  return {
    key: 'orders',
    version: '1.0.0',
    domain: 'core',
    flow: 'sys-schemas',
    attributes: {
      type: 'master',
      schema: { type: 'object', properties: { amount: { type: 'number', 'x-filterOperators': operators } } },
    },
  };
}

/** Same seeding as `VNextTab.vitest.test.tsx`: live state + the SSR snapshot. */
function seed(json: Record<string, unknown>): void {
  useSchemaEditorStore.getState().setComponent(json, '');
  Object.assign(useSchemaEditorStore.getInitialState(), { componentJson: json, filePath: '' });
}

afterEach(() => {
  useSchemaEditorStore.getState().clear();
  Object.assign(useSchemaEditorStore.getInitialState(), { componentJson: null, filePath: null });
});

function checkboxTag(html: string, op: string): string {
  return new RegExp(`<button[^>]*id="filter-op-_properties_amount-${op}"[^>]*>`).exec(html)?.[0] ?? '';
}

const render = (): string => renderToStaticMarkup(createElement(XFilterOperatorsCard, { pointer: '/properties/amount' }));

describe('XFilterOperatorsCard', () => {
  it('offers every runtime spelling', () => {
    seed(doc(['eq']));
    const html = render();
    for (const op of FILTER_OPERATORS) expect(checkboxTag(html, op.value)).not.toBe('');
  });

  it('shows legacy spellings as runtime operators without writing anything', () => {
    const json = doc(['ge', 'like', 'regex']);
    seed(json);
    const html = render();

    expect(checkboxTag(html, 'gte')).toContain('aria-checked="true"');
    expect(checkboxTag(html, 'contains')).toContain('aria-checked="true"');
    expect(checkboxTag(html, 'lt')).toContain('aria-checked="false"');
    expect(html).toContain('ge → gte');
    expect(html).toContain('like → contains');
    expect(html).toContain('regex');

    expect(useSchemaEditorStore.getState().isDirty).toBe(false);
    expect(useSchemaEditorStore.getState().componentJson).toBe(json);
  });
});
