import { describe, expect, it } from 'vitest';

import type { ViewResponse } from '../types/quickrun.types';
import { stateViewContentChanged } from './stateViewContentChanged';

function view(content: ViewResponse['content'], overrides: Partial<ViewResponse> = {}): ViewResponse {
  return { key: 'v1', type: 'pseudo-ui', content, ...overrides };
}

describe('stateViewContentChanged', () => {
  it('returns true when there is no current view to compare against', () => {
    expect(stateViewContentChanged(null, view({ foo: 'bar' }))).toBe(true);
  });

  it('returns false when the fetched content is identical to the current content', () => {
    const current = view({ foo: 'bar', nested: { a: 1 } });
    const next = view({ foo: 'bar', nested: { a: 1 } });
    expect(stateViewContentChanged(current, next)).toBe(false);
  });

  it('returns false for identical string content', () => {
    expect(stateViewContentChanged(view('<div>hi</div>'), view('<div>hi</div>'))).toBe(false);
  });

  it('returns true when the fetched content differs from the current content', () => {
    const current = view({ foo: 'bar' });
    const next = view({ foo: 'baz' });
    expect(stateViewContentChanged(current, next)).toBe(true);
  });

  it('ignores unrelated field changes (key/label) when content is unchanged', () => {
    const current = view({ foo: 'bar' }, { label: 'Old label' });
    const next = view({ foo: 'bar' }, { label: 'New label' });
    expect(stateViewContentChanged(current, next)).toBe(false);
  });
});
