import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ResourceReference } from '@vnext-forge-studio/vnext-types';
import {
  convertViewSwapEntryToKeyVersion,
  isRefForm,
  patchViewSwapMap,
  ViewSwapMapEditor,
} from './ViewSwapMapEditor';

const ref = (key: string): ResourceReference => ({ key, domain: 'core', version: '1.0.0', flow: 'sys-views' });
const refForm = { ref: './views/legacy.json' } as unknown as ResourceReference;

describe('isRefForm', () => {
  it('recognizes the { ref } shorthand and rejects the explicit form', () => {
    expect(isRefForm(refForm)).toBe(true);
    expect(isRefForm(ref('x'))).toBe(false);
  });
});

describe('patchViewSwapMap', () => {
  it('sets one field of an explicit-form entry', () => {
    const map = { v: ref('old') };
    expect(patchViewSwapMap(map, 'v', 'key', 'new')).toEqual({ v: { ...ref('old'), key: 'new' } });
  });

  it('never spreads into a ref-form entry — returns the map unchanged', () => {
    const map = { v: refForm };
    const result = patchViewSwapMap(map, 'v', 'key', 'new');
    expect(result).toBe(map);
    expect(result?.v).toEqual(refForm);
    expect(result?.v).not.toHaveProperty('key');
  });

  it('is a no-op for a missing key', () => {
    const map = { v: ref('old') };
    expect(patchViewSwapMap(map, 'missing', 'key', 'new')).toBe(map);
  });
});

describe('convertViewSwapEntryToKeyVersion', () => {
  it('replaces a { ref } entry with an empty explicit key/version/flow reference', () => {
    const map = { v: refForm, other: ref('kept') };
    const result = convertViewSwapEntryToKeyVersion(map, 'v');
    expect(result.v).toEqual({ key: '', domain: '', version: '1.0.0', flow: 'sys-views' });
    expect(result.other).toEqual(ref('kept'));
  });

  it('works from an undefined map', () => {
    expect(convertViewSwapEntryToKeyVersion(undefined, 'v')).toEqual({
      v: { key: '', domain: '', version: '1.0.0', flow: 'sys-views' },
    });
  });
});

function render(value: Record<string, ResourceReference> | undefined): string {
  return renderToStaticMarkup(
    createElement(ViewSwapMapEditor, {
      value,
      viewKeyOptions: ['child-view'],
      onChange: () => undefined,
    }),
  );
}

describe('ViewSwapMapEditor rendering', () => {
  it('renders a { ref } replacement read-only, with a Convert to key/version action, and no editable fields', () => {
    const html = render({ 'child-view': refForm });
    expect(html).toContain('./views/legacy.json');
    expect(html).toContain('Convert to key/version');
    expect(html).not.toContain('placeholder="key"');
    expect(html).not.toContain('placeholder="domain"');
  });

  it('renders an explicit-form replacement as editable key/domain/version/flow fields', () => {
    const html = render({ 'child-view': ref('replacement') });
    expect(html).toContain('value="replacement"');
    expect(html).toContain('placeholder="key"');
    expect(html).not.toContain('Convert to key/version');
  });
});
