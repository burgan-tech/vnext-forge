import { describe, expect, it } from 'vitest';

import { toViewResponse } from './functionRunView';

describe('toViewResponse', () => {
  it('adapts a contract exchange into the shape PseudoUiOrJsonBlock needs', () => {
    const result = toViewResponse({
      status: 200,
      contentType: 'application/json',
      responseHeaders: {},
      body: '{"key":"branch-form","type":"pseudo-ui","content":{"component":"Column"}}',
      json: { key: 'branch-form', type: 'pseudo-ui', content: { component: 'Column' } },
    });
    expect(result?.key).toBe('branch-form');
    expect(result?.type).toBe('pseudo-ui');
    expect(result?.content).toEqual({ component: 'Column' });
  });

  it('returns null when the contract returned no content', () => {
    // `hasView: false`, or a 404 — "no contract right now" is not an error.
    expect(toViewResponse(null)).toBeNull();
    // `json` deliberately carries a well-formed view payload here so this
    // case actually exercises the status guard — without it, the earlier
    // "is this a plain object with `content`" check would reject the
    // fixture on its own, and the 404 branch would never be reached.
    expect(
      toViewResponse({
        status: 404,
        contentType: 'application/json',
        responseHeaders: {},
        body: '{"key":"k","type":"pseudo-ui","content":{}}',
        json: { key: 'k', type: 'pseudo-ui', content: {} },
      }),
    ).toBeNull();
  });

  it('returns null when the body was not parseable JSON', () => {
    expect(
      toViewResponse({
        status: 200, contentType: 'application/json', responseHeaders: {},
        body: 'not json', jsonParseError: 'Unexpected token',
      }),
    ).toBeNull();
  });
});
