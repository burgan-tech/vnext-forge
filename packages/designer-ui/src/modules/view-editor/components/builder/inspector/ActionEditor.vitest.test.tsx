import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ActionEditor,
  SELECT_DEPRECATED_NOTE,
  isActiveReservedChip,
  offeredReservedVerbs,
  patchDescriptor,
} from './ActionEditor.js';

const noop = () => undefined;

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(ActionEditor, { onChange: noop, nodeType: 'ListTile', ...props } as never),
  );

describe('ActionEditor verbs', () => {
  it('offers set and lookup as reserved verbs and hides select for new actions', () => {
    expect(offeredReservedVerbs(['select'], undefined)).toEqual(['set', 'lookup']);
    expect(offeredReservedVerbs(['submit', 'reset'], undefined)).toEqual(['submit', 'reset']);
    const html = render({ value: undefined });
    expect(html).toContain('>set<');
    expect(html).toContain('>lookup<');
    expect(html).not.toContain('deprecated');
  });

  it('writes a set descriptor with mode, omitting mode for overwrite', () => {
    let d = patchDescriptor({ action: 'set' }, { data: '$form.city' });
    d = patchDescriptor(d, { value: 'Ankara' });
    expect(d).toEqual({ action: 'set', data: '$form.city', value: 'Ankara' });
    d = patchDescriptor(d, { mode: 'fill-empty' });
    expect(d).toEqual({ action: 'set', data: '$form.city', value: 'Ankara', mode: 'fill-empty' });
    d = patchDescriptor(d, { mode: 'overwrite' });
    expect(d).toEqual({ action: 'set', data: '$form.city', value: 'Ankara' });
    expect('mode' in d).toBe(false);
  });

  it('renders set fields (data, value, mode) for a set descriptor', () => {
    const html = render({
      value: { action: 'set', data: '$form.city', value: 'Ankara', mode: 'fill-empty' },
    });
    expect(html).toContain('aria-label="data"');
    expect(html).toContain('aria-label="mode"');
    expect(html).toContain('$form.city');
    expect(html).toContain('fill-empty');
  });

  it('writes a lookup descriptor', () => {
    expect(patchDescriptor({ action: 'lookup' }, { name: 'cities' })).toEqual({
      action: 'lookup',
      name: 'cities',
    });
    const html = render({ value: { action: 'lookup', name: 'cities' } });
    expect(html).toContain('aria-label="name"');
    expect(html).toContain('cities');
  });

  it('shows select as deprecated but keeps an existing select descriptor unchanged', () => {
    const existing = { action: 'select', bind: '$ui.tab', value: 2 };
    expect(offeredReservedVerbs(['select'], 'select')).toEqual(['set', 'lookup', 'select']);
    const html = render({ value: existing });
    expect(html).toContain(SELECT_DEPRECATED_NOTE);
    expect(html).toContain('select (deprecated)');
    expect(html).toContain('aria-label="bind"');
    expect(html).toContain('$ui.tab');
    // Rendering must not mutate the persisted descriptor.
    expect(existing).toEqual({ action: 'select', bind: '$ui.tab', value: 2 });
  });

  it('marks the chip of the current reserved verb active (a click on it is a no-op)', () => {
    expect(isActiveReservedChip('set', { verb: 'set', command: undefined, customMode: false })).toBe(true);
    expect(isActiveReservedChip('lookup', { verb: 'set', command: undefined, customMode: false })).toBe(false);
    expect(isActiveReservedChip('set', { verb: 'set', command: 'urn:x', customMode: false })).toBe(false);
    expect(isActiveReservedChip('set', { verb: 'set', command: undefined, customMode: true })).toBe(false);
  });
});
