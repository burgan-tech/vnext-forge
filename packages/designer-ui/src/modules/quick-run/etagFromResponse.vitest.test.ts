import { describe, expect, it } from 'vitest';

import { extractEtag } from './etagFromResponse';

describe('extractEtag', () => {
  it('returns undefined for null/undefined input', () => {
    expect(extractEtag(null)).toBeUndefined();
    expect(extractEtag(undefined)).toBeUndefined();
  });

  it('returns undefined when neither a header nor a payload eTag is present', () => {
    expect(extractEtag({})).toBeUndefined();
    expect(extractEtag({ responseHeaders: {} })).toBeUndefined();
  });

  it('reads a lowercase etag header (the network adapter default)', () => {
    expect(extractEtag({ responseHeaders: { etag: 'W/"abc123"' } })).toBe('W/"abc123"');
  });

  it('is case-insensitive when scanning header keys', () => {
    expect(extractEtag({ responseHeaders: { ETag: '"xyz"' } })).toBe('"xyz"');
    expect(extractEtag({ responseHeaders: { ETAG: '"xyz2"' } })).toBe('"xyz2"');
  });

  it('prefers the header value over a payload eTag when both are present', () => {
    expect(
      extractEtag({ responseHeaders: { etag: 'from-header' }, eTag: 'from-payload' }),
    ).toBe('from-header');
  });

  it('falls back to the payload eTag field when no header is present', () => {
    expect(extractEtag({ eTag: 'from-payload' })).toBe('from-payload');
  });

  it('ignores an empty-string header value and falls back to the payload eTag', () => {
    expect(extractEtag({ responseHeaders: { etag: '' }, eTag: 'from-payload' })).toBe('from-payload');
  });
});
