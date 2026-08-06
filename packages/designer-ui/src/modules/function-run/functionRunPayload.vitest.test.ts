import { describe, expect, it } from 'vitest';

import {
  buildInvokeRequest,
  carriesBody,
  CONTENT_TYPES,
  parseQueryString,
  resolveEffectiveMode,
  resolveEffectiveRequestTab,
  stringifyQueryPairs,
} from './functionRunPayload';

const PAYLOAD = { branchCode: '001', includeClosed: true };

describe('buildInvokeRequest — body-bearing verbs', () => {
  it('sends JSON for POST', () => {
    expect(
      buildInvokeRequest({ verb: 'POST', mode: 'payload', payload: PAYLOAD, contentType: 'json', queryString: '' }),
    ).toEqual({ body: JSON.stringify(PAYLOAD), contentType: 'application/json' });
  });

  it('sends form-urlencoded for POST', () => {
    const result = buildInvokeRequest({
      verb: 'POST',
      mode: 'payload',
      payload: PAYLOAD,
      contentType: 'form',
      queryString: '',
    });
    expect(result.contentType).toBe('application/x-www-form-urlencoded');
    expect(result.body).toBe('branchCode=001&includeClosed=true');
    expect(result.query).toBeUndefined();
  });

  it('treats PATCH like POST', () => {
    expect(
      buildInvokeRequest({ verb: 'PATCH', mode: 'payload', payload: PAYLOAD, contentType: 'json', queryString: '' })
        .body,
    ).toBe(JSON.stringify(PAYLOAD));
  });
});

describe('buildInvokeRequest — verbs that carry no body', () => {
  it('turns the payload into a query for GET and never sets a body', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: PAYLOAD,
      contentType: 'json',
      queryString: '',
    });
    expect(result.body).toBeUndefined();
    expect(result.contentType).toBeUndefined();
    expect(result.query).toEqual({ branchCode: '001', includeClosed: 'true' });
  });

  it('does the same for DELETE regardless of the selected content type', () => {
    const result = buildInvokeRequest({
      verb: 'DELETE',
      mode: 'payload',
      payload: PAYLOAD,
      contentType: 'form',
      queryString: '',
    });
    expect(result.body).toBeUndefined();
    expect(result.query).toEqual({ branchCode: '001', includeClosed: 'true' });
  });

  it('stringifies nested values for the query rather than dropping them', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: { filter: { a: 1 } },
      contentType: 'json',
      queryString: '',
    });
    expect(result.query).toEqual({ filter: '{"a":1}' });
  });
});

describe('buildInvokeRequest — mode selection', () => {
  it('sends the view form data in view mode', () => {
    const result = buildInvokeRequest({
      verb: 'POST',
      mode: 'view',
      viewFormData: { fromView: 1 },
      payload: { fromPayload: 2 },
      contentType: 'json',
      queryString: '',
    });
    expect(result.body).toBe(JSON.stringify({ fromView: 1 }));
  });

  it('sends the payload editor content in payload mode', () => {
    const result = buildInvokeRequest({
      verb: 'POST',
      mode: 'payload',
      viewFormData: { fromView: 1 },
      payload: { fromPayload: 2 },
      contentType: 'json',
      queryString: '',
    });
    expect(result.body).toBe(JSON.stringify({ fromPayload: 2 }));
  });
});

describe('buildInvokeRequest — empty input', () => {
  it('omits the body entirely when there is nothing to send', () => {
    // Asserted on the KEYS, not with toEqual against an all-undefined object:
    // Vitest treats an absent property and one set to `undefined` as equal, so
    // a toEqual assertion here passes against either shape and cannot protect
    // the "omit rather than set undefined" behaviour it is named for.
    const result = buildInvokeRequest({
      verb: 'POST',
      mode: 'payload',
      payload: {},
      contentType: 'json',
      queryString: '',
    });
    expect(Object.keys(result)).toEqual([]);
  });

  it('omits the query when there is nothing to send', () => {
    expect(
      buildInvokeRequest({ verb: 'GET', mode: 'payload', payload: {}, contentType: 'json', queryString: '' }).query,
    ).toBeUndefined();
  });
});

describe('buildInvokeRequest — null-valued fields', () => {
  // A null field means "no value entered", not "send an empty string" — a
  // query string of `?branch=` or a form body of `branch=` would tell the
  // runtime engine something different from "the caller left this blank".
  it('omits a null-valued field from the query instead of encoding it as empty', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: { branchCode: '001', region: null },
      contentType: 'json',
      queryString: '',
    });
    expect(result.query).toEqual({ branchCode: '001' });
  });

  it('omits a null-valued field from a form body the same way', () => {
    const result = buildInvokeRequest({
      verb: 'POST',
      mode: 'payload',
      payload: { branchCode: '001', region: null },
      contentType: 'form',
      queryString: '',
    });
    expect(result.body).toBe('branchCode=001');
  });

  it('treats an all-null payload as nothing to send for GET', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: { region: null },
      contentType: 'json',
      queryString: '',
    });
    expect(result.query).toBeUndefined();
  });

  it('keeps a null value in a JSON body, where null is a meaningful value', () => {
    // Unlike the query/form encodings, JSON has a first-class `null` — a
    // caller invoking PATCH with `{ "region": null }` most likely means
    // "clear this field", and JSON.stringify already expresses that.
    const result = buildInvokeRequest({
      verb: 'PATCH',
      mode: 'payload',
      payload: { region: null },
      contentType: 'json',
      queryString: '',
    });
    expect(result.body).toBe('{"region":null}');
  });
});

describe('buildInvokeRequest — query-string input (Fix 3)', () => {
  it('sends an explicit query string alongside a JSON body for POST', () => {
    // A function can legitimately take both a body and query parameters —
    // the query-string input is available for every verb, not only the
    // body-less ones.
    const result = buildInvokeRequest({
      verb: 'POST',
      mode: 'payload',
      payload: PAYLOAD,
      contentType: 'json',
      queryString: 'dryRun=true',
    });
    expect(result.body).toBe(JSON.stringify(PAYLOAD));
    expect(result.query).toEqual({ dryRun: 'true' });
  });

  it('merges the query string with the mode data for a body-less verb', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: { branchCode: '001' },
      contentType: 'json',
      queryString: 'page=2',
    });
    expect(result.query).toEqual({ branchCode: '001', page: '2' });
  });

  it('lets the explicit query string win over the mode data on a key conflict', () => {
    // Mirrors `function-run.service.ts`'s own `invoke`, where an explicit
    // `query` record wins over whatever was already embedded in the path.
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: { branchCode: '001' },
      contentType: 'json',
      queryString: 'branchCode=999',
    });
    expect(result.query).toEqual({ branchCode: '999' });
  });

  it('accepts a leading "?" on the query string', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: {},
      contentType: 'json',
      queryString: '?a=1&b=2',
    });
    expect(result.query).toEqual({ a: '1', b: '2' });
  });

  it('produces a query for a body-bearing verb from the query string alone', () => {
    const result = buildInvokeRequest({
      verb: 'PATCH',
      mode: 'payload',
      payload: {},
      contentType: 'json',
      queryString: 'a=1',
    });
    expect(result.body).toBeUndefined();
    expect(result.query).toEqual({ a: '1' });
  });

  it('omits query entirely when the query string is blank and there is no mode data', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: {},
      contentType: 'json',
      queryString: '   ',
    });
    expect(result.query).toBeUndefined();
  });
});

describe('carriesBody', () => {
  it('is true for POST and PATCH', () => {
    expect(carriesBody('POST')).toBe(true);
    expect(carriesBody('PATCH')).toBe(true);
  });

  it('is false for GET and DELETE', () => {
    expect(carriesBody('GET')).toBe(false);
    expect(carriesBody('DELETE')).toBe(false);
  });
});

describe('resolveEffectiveMode', () => {
  it('keeps the stored mode for a body-bearing verb', () => {
    expect(resolveEffectiveMode('payload', 'POST')).toBe('payload');
    expect(resolveEffectiveMode('view', 'PATCH')).toBe('view');
  });

  it('forces view for a body-less verb, even if the stored mode is payload', () => {
    expect(resolveEffectiveMode('payload', 'GET')).toBe('view');
    expect(resolveEffectiveMode('payload', 'DELETE')).toBe('view');
  });

  it('is a no-op override — view stays view for a body-less verb', () => {
    expect(resolveEffectiveMode('view', 'GET')).toBe('view');
  });
});

describe('parseQueryString', () => {
  it('parses key=value pairs joined with &', () => {
    expect(parseQueryString('a=1&b=2')).toEqual({ a: '1', b: '2' });
  });

  it('strips a leading "?"', () => {
    expect(parseQueryString('?a=1')).toEqual({ a: '1' });
  });

  it('returns an empty record for a blank or whitespace-only string', () => {
    expect(parseQueryString('')).toEqual({});
    expect(parseQueryString('   ')).toEqual({});
    expect(parseQueryString('?')).toEqual({});
  });

  it('lets URLSearchParams handle percent-encoding', () => {
    expect(parseQueryString('name=a%20b')).toEqual({ name: 'a b' });
  });

  it('keeps only the last value for a repeated key', () => {
    expect(parseQueryString('a=1&a=2')).toEqual({ a: '2' });
  });
});

describe('CONTENT_TYPES', () => {
  it('exposes exactly the two media types the proxy allows', () => {
    expect(CONTENT_TYPES.json).toBe('application/json');
    expect(CONTENT_TYPES.form).toBe('application/x-www-form-urlencoded');
  });
});

describe('stringifyQueryPairs', () => {
  it('round-trips a simple set of pairs through parseQueryString', () => {
    const qs = stringifyQueryPairs([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(parseQueryString(qs)).toEqual({ a: '1', b: '2' });
  });

  it('returns an empty string for empty input', () => {
    expect(stringifyQueryPairs([])).toBe('');
  });

  it('lets URLSearchParams encode special characters, and parseQueryString decodes them back', () => {
    const qs = stringifyQueryPairs([{ key: 'q', value: 'a b&c=d' }]);
    // Pinned to the exact wire form (not just the round trip) so a switch
    // away from URLSearchParams — e.g. hand-rolled encodeURIComponent, which
    // encodes a space as %20 rather than + — would be caught here even if it
    // happened to still round-trip correctly.
    expect(qs).toBe('q=a+b%26c%3Dd');
    expect(parseQueryString(qs)).toEqual({ q: 'a b&c=d' });
  });

  it('drops an empty-key row, matching parseQueryString skipping it on the way back in', () => {
    const qs = stringifyQueryPairs([
      { key: '', value: 'orphaned' },
      { key: 'a', value: '1' },
    ]);
    expect(qs).toBe('a=1');
  });

  it('preserves duplicate keys in the string itself, even though parseQueryString then collapses them', () => {
    const qs = stringifyQueryPairs([
      { key: 'a', value: '1' },
      { key: 'a', value: '2' },
    ]);
    // Not collapsed here — a `.set`-based implementation would produce
    // `a=2` directly and this assertion would not tell the two apart from
    // the correct `.append`-based one, since parseQueryString collapses
    // either way. Asserting the string itself pins down *which* layer does
    // the collapsing.
    expect(qs).toBe('a=1&a=2');
    expect(parseQueryString(qs)).toEqual({ a: '2' });
  });
});

describe('resolveEffectiveRequestTab', () => {
  it('keeps the stored tab for params and headers regardless of verb', () => {
    expect(resolveEffectiveRequestTab('params', 'GET')).toBe('params');
    expect(resolveEffectiveRequestTab('headers', 'GET')).toBe('headers');
    expect(resolveEffectiveRequestTab('headers', 'POST')).toBe('headers');
  });

  it('keeps the body tab for a body-bearing verb', () => {
    expect(resolveEffectiveRequestTab('body', 'POST')).toBe('body');
    expect(resolveEffectiveRequestTab('body', 'PATCH')).toBe('body');
  });

  it('falls back to params when the body tab is selected but the verb carries no body', () => {
    expect(resolveEffectiveRequestTab('body', 'GET')).toBe('params');
    expect(resolveEffectiveRequestTab('body', 'DELETE')).toBe('params');
  });
});
