import { describe, expect, it } from 'vitest';

import { buildInvokeRequest, CONTENT_TYPES } from './functionRunPayload';

const PAYLOAD = { branchCode: '001', includeClosed: true };

describe('buildInvokeRequest — body-bearing verbs', () => {
  it('sends JSON for POST', () => {
    expect(
      buildInvokeRequest({ verb: 'POST', mode: 'payload', payload: PAYLOAD, contentType: 'json' }),
    ).toEqual({ body: JSON.stringify(PAYLOAD), contentType: 'application/json' });
  });

  it('sends form-urlencoded for POST', () => {
    const result = buildInvokeRequest({
      verb: 'POST',
      mode: 'payload',
      payload: PAYLOAD,
      contentType: 'form',
    });
    expect(result.contentType).toBe('application/x-www-form-urlencoded');
    expect(result.body).toBe('branchCode=001&includeClosed=true');
    expect(result.query).toBeUndefined();
  });

  it('treats PATCH like POST', () => {
    expect(
      buildInvokeRequest({ verb: 'PATCH', mode: 'payload', payload: PAYLOAD, contentType: 'json' }).body,
    ).toBe(JSON.stringify(PAYLOAD));
  });
});

describe('buildInvokeRequest — verbs that carry no body', () => {
  it('turns the payload into a query for GET and never sets a body', () => {
    const result = buildInvokeRequest({ verb: 'GET', mode: 'payload', payload: PAYLOAD, contentType: 'json' });
    expect(result.body).toBeUndefined();
    expect(result.contentType).toBeUndefined();
    expect(result.query).toEqual({ branchCode: '001', includeClosed: 'true' });
  });

  it('does the same for DELETE regardless of the selected content type', () => {
    const result = buildInvokeRequest({ verb: 'DELETE', mode: 'payload', payload: PAYLOAD, contentType: 'form' });
    expect(result.body).toBeUndefined();
    expect(result.query).toEqual({ branchCode: '001', includeClosed: 'true' });
  });

  it('stringifies nested values for the query rather than dropping them', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: { filter: { a: 1 } },
      contentType: 'json',
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
    });
    expect(Object.keys(result)).toEqual([]);
  });

  it('omits the query when there is nothing to send', () => {
    expect(
      buildInvokeRequest({ verb: 'GET', mode: 'payload', payload: {}, contentType: 'json' }).query,
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
    });
    expect(result.query).toEqual({ branchCode: '001' });
  });

  it('omits a null-valued field from a form body the same way', () => {
    const result = buildInvokeRequest({
      verb: 'POST',
      mode: 'payload',
      payload: { branchCode: '001', region: null },
      contentType: 'form',
    });
    expect(result.body).toBe('branchCode=001');
  });

  it('treats an all-null payload as nothing to send for GET', () => {
    const result = buildInvokeRequest({
      verb: 'GET',
      mode: 'payload',
      payload: { region: null },
      contentType: 'json',
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
    });
    expect(result.body).toBe('{"region":null}');
  });
});

describe('CONTENT_TYPES', () => {
  it('exposes exactly the two media types the proxy allows', () => {
    expect(CONTENT_TYPES.json).toBe('application/json');
    expect(CONTENT_TYPES.form).toBe('application/x-www-form-urlencoded');
  });
});
