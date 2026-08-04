import { describe, expect, it } from 'vitest';

import {
  formatViewDisplay,
  isKnownViewDisplay,
  parseViewDisplay,
  serializeViewDisplay,
  VIEW_DISPLAY_OPTIONS,
  type ViewDisplayModes,
} from '@vnext-forge-studio/vnext-types';

/**
 * The `attributes.display` codec lives in `vnext-types` (the dependency-policy
 * leaf every consumer already depends on), but that package has no test runner
 * and never has had one. Its tests live here instead — designer-ui is the
 * primary consumer, already on vitest, and already hosts the other view tests —
 * rather than adding a test task to a leaf package for one module.
 */
describe('parseViewDisplay', () => {
  it('reads the legacy bare string as the SDI value', () => {
    expect(parseViewDisplay('popup')).toEqual({ sdi: 'popup' });
  });

  it('reads the per-mode object form', () => {
    expect(parseViewDisplay({ sdi: 'popup', mdi: 'drawer' })).toEqual({ sdi: 'popup', mdi: 'drawer' });
  });

  it('reads an MDI-only declaration', () => {
    expect(parseViewDisplay({ mdi: 'full-page' })).toEqual({ mdi: 'full-page' });
  });

  it('treats an absent, empty or blank value as nothing declared', () => {
    expect(parseViewDisplay(undefined)).toEqual({});
    expect(parseViewDisplay(null)).toEqual({});
    expect(parseViewDisplay('')).toEqual({});
    expect(parseViewDisplay('   ')).toEqual({});
    expect(parseViewDisplay({})).toEqual({});
    expect(parseViewDisplay({ sdi: '', mdi: '  ' })).toEqual({});
  });

  it('ignores shapes that cannot carry a display', () => {
    expect(parseViewDisplay(42)).toEqual({});
    expect(parseViewDisplay(true)).toEqual({});
    // An array is an object to `typeof`, so this guards the Array.isArray check.
    expect(parseViewDisplay(['popup'])).toEqual({});
  });

  it('preserves an unrecognised value instead of dropping it', () => {
    // The runtime accepts any non-blank string — the vocabulary is documented
    // there, not enforced. Discarding it would make the editor silently delete
    // data it does not understand; membership is the JSON schema's job.
    expect(parseViewDisplay('side-rail')).toEqual({ sdi: 'side-rail' });
    expect(parseViewDisplay({ mdi: 'carousel' })).toEqual({ mdi: 'carousel' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseViewDisplay('  popup  ')).toEqual({ sdi: 'popup' });
  });
});

describe('serializeViewDisplay', () => {
  it('writes an SDI-only declaration as a bare string', () => {
    expect(serializeViewDisplay({ sdi: 'popup' })).toBe('popup');
  });

  it('writes an object once MDI is declared', () => {
    expect(serializeViewDisplay({ sdi: 'popup', mdi: 'drawer' })).toEqual({
      sdi: 'popup',
      mdi: 'drawer',
    });
  });

  it('omits sdi from the object when only MDI is set', () => {
    expect(serializeViewDisplay({ mdi: 'full-page' })).toEqual({ mdi: 'full-page' });
  });

  it('returns undefined when neither mode is set, so the caller removes the key', () => {
    // Not `{}`: display is optional, but an empty object fails the schema's
    // "at least one of sdi / mdi" rule.
    expect(serializeViewDisplay({})).toBeUndefined();
    expect(serializeViewDisplay({ sdi: undefined, mdi: undefined })).toBeUndefined();
  });
});

describe('display round-trip (churn guard)', () => {
  const roundTrip = (raw: unknown) => serializeViewDisplay(parseViewDisplay(raw));

  it.each(VIEW_DISPLAY_OPTIONS.map((o) => o.value))(
    'keeps the bare string %s a bare string',
    (value) => {
      // The load-bearing case. If this ever returns an object, every save of an
      // existing SDI-only view rewrites `"popup"` as `{"sdi":"popup"}` and churns
      // the component JSON of every domain repo.
      expect(roundTrip(value)).toBe(value);
    },
  );

  it('keeps the object form an object', () => {
    expect(roundTrip({ sdi: 'drawer', mdi: 'top-sheet' })).toEqual({ sdi: 'drawer', mdi: 'top-sheet' });
    expect(roundTrip({ mdi: 'full-page' })).toEqual({ mdi: 'full-page' });
  });

  it('collapses to a bare string when MDI is cleared', () => {
    const cleared: ViewDisplayModes = { ...parseViewDisplay({ sdi: 'popup', mdi: 'drawer' }), mdi: undefined };
    expect(serializeViewDisplay(cleared)).toBe('popup');
  });

  it('promotes to an object when MDI is added to a legacy string', () => {
    const promoted: ViewDisplayModes = { ...parseViewDisplay('popup'), mdi: 'drawer' };
    expect(serializeViewDisplay(promoted)).toEqual({ sdi: 'popup', mdi: 'drawer' });
  });

  it('drops the key when the last mode is cleared', () => {
    const emptied: ViewDisplayModes = { ...parseViewDisplay('popup'), sdi: undefined };
    expect(serializeViewDisplay(emptied)).toBeUndefined();
  });
});

describe('formatViewDisplay', () => {
  it('prints a lone mode plainly', () => {
    expect(formatViewDisplay('popup')).toBe('popup');
    expect(formatViewDisplay({ mdi: 'full-page' })).toBe('MDI: full-page');
  });

  it('labels both modes when both are declared', () => {
    expect(formatViewDisplay({ sdi: 'popup', mdi: 'drawer' })).toBe('SDI: popup · MDI: drawer');
  });

  it('uses the placeholder when nothing is declared', () => {
    expect(formatViewDisplay(undefined)).toBe('—');
    expect(formatViewDisplay({}, '-')).toBe('-');
  });

  it('never leaks a stringified object', () => {
    expect(formatViewDisplay({ sdi: 'popup', mdi: 'drawer' })).not.toContain('[object');
  });
});

describe('vocabulary', () => {
  it('matches the JSON schema display definitions', () => {
    expect(VIEW_DISPLAY_OPTIONS.map((o) => o.value)).toEqual([
      'full-page',
      'popup',
      'drawer',
      'bottom-sheet',
      'top-sheet',
      'inline',
    ]);
  });

  it('offers the same values to both modes', () => {
    // SDI and MDI share one vocabulary; the mode picks which client interface
    // the value applies to. A second list would imply a difference that is not
    // there — and would let the two drift.
    expect(VIEW_DISPLAY_OPTIONS.every((o) => isKnownViewDisplay(o.value))).toBe(true);
  });

  it('recognises documented values and rejects others', () => {
    expect(isKnownViewDisplay('full-page')).toBe(true);
    expect(isKnownViewDisplay('drawer')).toBe(true);
    // Values from the superseded MDI-only vocabulary are no longer valid.
    expect(isKnownViewDisplay('tab')).toBe(false);
    expect(isKnownViewDisplay('window')).toBe(false);
    expect(isKnownViewDisplay('split')).toBe(false);
    expect(isKnownViewDisplay(undefined)).toBe(false);
  });
});
