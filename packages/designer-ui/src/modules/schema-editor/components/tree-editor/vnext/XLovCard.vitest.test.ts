import { describe, expect, it } from 'vitest';

import { normalizeFilterEntries, textToList } from './FilterListEditor';
import { serializeXLov, toXLovValue, withLovMode } from './XLovCard';

describe('x-lov (vnext-schema 0.0.56)', () => {
  it('round-trips an items-based list with an image field', () => {
    const stored = { items: '$instance.accounts', valueField: '', displayField: 'name', imageField: 'logo' };
    const value = toXLovValue(stored);
    expect(value.mode).toBe('items');
    expect(serializeXLov(value)).toEqual(stored);
  });

  it('writes exactly one of source and items', () => {
    const fromSource = toXLovValue({ source: 'urn:x', valueField: '$.a', displayField: '$.b' });
    const switched = serializeXLov(withLovMode({ ...fromSource, items: '$form.list' }, 'items'));
    expect(switched).toEqual({ items: '$form.list', valueField: '', displayField: '' });
    expect(switched).not.toHaveProperty('source');
  });

  it('keeps list literals and operator suffixes on filters', () => {
    const filter = [{ param: 'status:in', value: ['active', 'pending'], required: false }];
    expect(normalizeFilterEntries(filter)).toEqual(filter);
    expect(serializeXLov(toXLovValue({ source: 'urn:x', valueField: '$.a', displayField: '$.b', filter })).filter).toEqual(
      filter,
    );
  });

  it('splits comma-separated list text', () => {
    expect(textToList(' a, b ,, c ')).toEqual(['a', 'b', 'c']);
  });
});
