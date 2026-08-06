import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { FunctionCatalogEntry } from '../types/quickrun.types';
import { InstanceFunctions, type InstanceFunctionsProps } from './InstanceFunctions';

const ENTRIES: FunctionCatalogEntry[] = [
  {
    name: 'multi-task-function-test',
    version: '1.0.0',
    scope: 'I',
    href: '/core/workflows/w/instances/i/functions/multi-task-function-test/info',
  },
  {
    name: 'get-cache-instance',
    version: '1.0.0',
    scope: 'I',
    href: '/core/workflows/w/instances/i/functions/get-cache-instance/info',
  },
];

const render = (over: Partial<InstanceFunctionsProps> = {}) =>
  renderToStaticMarkup(
    createElement(InstanceFunctions, {
      entries: ENTRIES,
      loading: false,
      error: null,
      selected: null,
      onSelect: () => undefined,
      onOpen: () => undefined,
      ...over,
    }),
  );

describe('InstanceFunctions', () => {
  it('lists every catalog entry by name, with its version', () => {
    const html = render();
    expect(html).toContain('multi-task-function-test');
    expect(html).toContain('get-cache-instance');
    expect(html).toContain('v1.0.0');
  });

  it('shows the loading state instead of the picker while the catalog is in flight', () => {
    const html = render({ loading: true, entries: null });
    expect(html).toContain('Loading functions');
    expect(html).not.toContain('<select');
  });

  it('surfaces a catalog failure instead of pretending there are no functions', () => {
    // The engine said `hasFunctions: true`, so an empty list here would be a
    // lie — the fetch failed and the user needs to know that specifically.
    const html = render({ error: 'Runtime returned HTTP 403', entries: null });
    expect(html).toContain('Runtime returned HTTP 403');
    expect(html).not.toContain('No functions available');
  });

  it('says so plainly when the catalog came back empty', () => {
    const html = render({ entries: [] });
    expect(html).toContain('No functions available');
  });

  it('disables Open until a function is picked', () => {
    expect(render({ selected: null })).toMatch(/<button[^>]*disabled=""/);
    expect(render({ selected: 'get-cache-instance' })).not.toMatch(/<button[^>]*disabled=""/);
  });

  it('does not offer Open at all when the host cannot navigate', () => {
    // designer-ui owns no router; a host that passes no `onOpen` (or a
    // future embedding with nowhere to go) still gets the listing.
    const html = render({ onOpen: undefined, selected: 'get-cache-instance' });
    expect(html).not.toContain('>Open<');
    expect(html).toContain('get-cache-instance');
  });

  it('marks the picked function as selected', () => {
    const html = render({ selected: 'get-cache-instance' });
    expect(html).toMatch(/<option[^>]*value="get-cache-instance"[^>]*selected/);
  });
});
