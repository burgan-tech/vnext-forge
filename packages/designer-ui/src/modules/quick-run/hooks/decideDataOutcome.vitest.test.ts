import { describe, expect, it } from 'vitest';

import { decideDataOutcome } from './decideDataOutcome';

describe('decideDataOutcome', () => {
  it('clears on an engine/network failure response', () => {
    expect(
      decideDataOutcome({ success: false, error: { code: 'FORBIDDEN', message: 'nope' } }),
    ).toEqual({ kind: 'clear' });
  });

  it('keeps on a 304 (notModified) response', () => {
    expect(
      decideDataOutcome({ success: true, data: { data: {}, notModified: true } }),
    ).toEqual({ kind: 'keep' });
  });

  it('updates with the fresh data + extracted ETag on a 200 response', () => {
    expect(
      decideDataOutcome({
        success: true,
        data: { data: { foo: 'bar' }, responseHeaders: { etag: 'W/"abc"' } },
      }),
    ).toEqual({ kind: 'update', data: { data: { foo: 'bar' }, responseHeaders: { etag: 'W/"abc"' } }, etag: 'W/"abc"' });
  });

  it('updates with an undefined etag when the 200 response carries none', () => {
    expect(decideDataOutcome({ success: true, data: { data: { foo: 'bar' } } })).toEqual({
      kind: 'update',
      data: { data: { foo: 'bar' } },
      etag: undefined,
    });
  });
});
