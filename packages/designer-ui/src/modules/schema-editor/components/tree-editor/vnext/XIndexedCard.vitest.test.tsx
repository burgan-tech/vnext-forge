import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { INDEX_MESSAGES, type IndexNodeInfo } from '../../../model/indexEligibility';
import { XIndexedCardView, type XIndexedCardViewProps } from './XIndexedCard';

const eligible: IndexNodeInfo = { pointer: '/properties/amount', path: 'amount', eligible: true, indexed: undefined };
const ineligible: IndexNodeInfo = {
  pointer: '/properties/tags',
  path: 'tags',
  eligible: false,
  reason: 'notScalar',
  indexed: undefined,
};

const render = (over: Partial<XIndexedCardViewProps> = {}): string =>
  renderToStaticMarkup(
    createElement(XIndexedCardView, {
      pointer: '/properties/amount',
      enabled: false,
      value: undefined,
      info: eligible,
      columns: [],
      violation: null,
      onToggle: () => undefined,
      onSelect: () => undefined,
      ...over,
    }),
  );

const toggleTag = (html: string): string => /<button[^>]*id="vnext-toggle-x-indexed"[^>]*>/.exec(html)?.[0] ?? '';

describe('XIndexedCardView', () => {
  it('offers the toggle on an eligible field', () => {
    const html = render();
    expect(html).toContain('x-indexed');
    // CONTROLLER RULING F1: match the disabled ATTRIBUTE, not the substring
    // "disabled" — the Checkbox class always contains "disabled:cursor-not-allowed".
    expect(toggleTag(html)).not.toMatch(/\sdisabled=""/);
  });

  it('disables the toggle with the reason on an ineligible field', () => {
    const html = render({ info: ineligible });
    expect(toggleTag(html)).toMatch(/\sdisabled=""/);
    expect(html).toContain(`title="${INDEX_MESSAGES.notScalar}"`);
  });

  it('keeps a set value removable even when the field became ineligible', () => {
    const html = render({ info: { ...ineligible, indexed: true }, enabled: true, value: true });
    expect(toggleTag(html)).not.toMatch(/\sdisabled=""/);
  });

  it('shows the produced columns and the filter/sort note', () => {
    const html = render({ enabled: true, value: true, info: { ...eligible, indexed: true }, columns: ['text', 'numeric'] });
    expect(html).toContain('text, numeric');
    expect(html).toContain('Indexed (true)');
    expect(html).toContain('Not indexed (false)');
    expect(html).toContain('does not make the field filterable or sortable');
    expect(html).toContain('wf indexes generate');
  });

  it('shows the violation', () => {
    const html = render({ enabled: true, value: true, violation: INDEX_MESSAGES.notMaster });
    expect(html).toContain(INDEX_MESSAGES.notMaster);
  });
});
