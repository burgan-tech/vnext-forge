import { describe, expect, it } from 'vitest';

import { buildEndpointPreview } from './functionRunEndpoint';
import type { FunctionInfo } from './types/functionRun.types';

const baseInput = {
  info: null,
  scope: 'D' as const,
  domain: 'core',
  functionKey: 'get-branches',
  workflowKey: '',
  instanceId: '',
  queryString: '',
};

function makeInfo(href: string): FunctionInfo {
  return {
    key: 'get-branches',
    domain: 'core',
    version: '1.0.0',
    scope: 'D',
    function: { verbs: ['GET'], href },
  };
}

describe('buildEndpointPreview', () => {
  it('builds the domain-scoped fallback route before /info loads', () => {
    expect(buildEndpointPreview(baseInput)).toBe('/api/v1/core/functions/get-branches');
  });

  it('builds the F-scoped fallback route with both ids present', () => {
    expect(
      buildEndpointPreview({
        ...baseInput,
        scope: 'F',
        workflowKey: 'onboarding',
        instanceId: 'inst-1',
      }),
    ).toBe('/api/v1/core/workflows/onboarding/instances/inst-1/functions/get-branches');
  });

  it('builds the I-scoped fallback route with both ids present', () => {
    expect(
      buildEndpointPreview({
        ...baseInput,
        scope: 'I',
        workflowKey: 'onboarding',
        instanceId: 'inst-1',
      }),
    ).toBe('/api/v1/core/workflows/onboarding/instances/inst-1/functions/get-branches');
  });

  it('uses named placeholders for missing F/I ids rather than an empty path segment', () => {
    expect(buildEndpointPreview({ ...baseInput, scope: 'F', workflowKey: '', instanceId: '' })).toBe(
      '/api/v1/core/workflows/{workflowKey}/instances/{instanceId}/functions/get-branches',
    );
  });

  it('placeholders only the missing half when just one F/I id is present', () => {
    expect(
      buildEndpointPreview({ ...baseInput, scope: 'F', workflowKey: 'onboarding', instanceId: '' }),
    ).toBe('/api/v1/core/workflows/onboarding/instances/{instanceId}/functions/get-branches');
    expect(
      buildEndpointPreview({ ...baseInput, scope: 'F', workflowKey: '', instanceId: 'inst-1' }),
    ).toBe('/api/v1/core/workflows/{workflowKey}/instances/inst-1/functions/get-branches');
  });

  it('a loaded info.href beats the fallback, even for a non-D scope', () => {
    // Deliberately a *different* shape from what the F-scope fallback would
    // build for these exact ids (`/api/v1/core/workflows/onboarding/
    // instances/inst-1/functions/get-branches`) — a fixture where `info`'s
    // href happened to equal the fallback's own output would not actually
    // prove `info` is read at all, since either code path would produce the
    // same string.
    expect(
      buildEndpointPreview({
        ...baseInput,
        scope: 'F',
        workflowKey: 'onboarding',
        instanceId: 'inst-1',
        info: makeInfo('/core/functions/get-branches'),
      }),
    ).toBe('/api/v1/core/functions/get-branches');
  });

  it('prepends /api/v1 to a loaded href that does not already carry it', () => {
    // Scope F with no ids at all — the fallback for that combination is
    // `/api/v1/core/workflows/{workflowKey}/instances/{instanceId}/
    // functions/get-branches`, nothing like the expected value below, so
    // this only passes if `info.href` is actually the source.
    expect(
      buildEndpointPreview({ ...baseInput, scope: 'F', info: makeInfo('/core/functions/get-branches') }),
    ).toBe('/api/v1/core/functions/get-branches');
  });

  it('does not double-prefix a loaded href that already starts with /api/v1', () => {
    expect(
      buildEndpointPreview({
        ...baseInput,
        scope: 'F',
        info: makeInfo('/api/v1/core/functions/get-branches'),
      }),
    ).toBe('/api/v1/core/functions/get-branches');
  });

  it('strips a gateway prefix, matching what the request actually goes to', () => {
    // The bar must not show `/api/v1/core/…` while the wire sends
    // `/api/v1/api/core/…`, nor the reverse. Mirrors
    // `rebaseRuntimeHref`'s own service-level test.
    expect(
      buildEndpointPreview({ ...baseInput, info: makeInfo('/api/core/functions/get-branches') }),
    ).toBe('/api/v1/core/functions/get-branches');
  });

  it('falls back to prefixing when the href does not contain the domain', () => {
    expect(
      buildEndpointPreview({ ...baseInput, info: makeInfo('/other/functions/get-branches') }),
    ).toBe('/api/v1/other/functions/get-branches');
  });

  it('appends a query string that has no leading ?', () => {
    expect(buildEndpointPreview({ ...baseInput, queryString: 'a=1&b=2' })).toBe(
      '/api/v1/core/functions/get-branches?a=1&b=2',
    );
  });

  it('normalizes a query string that already has a leading ?', () => {
    expect(buildEndpointPreview({ ...baseInput, queryString: '?a=1&b=2' })).toBe(
      '/api/v1/core/functions/get-branches?a=1&b=2',
    );
  });

  it('appends nothing for a blank or whitespace-only query string', () => {
    expect(buildEndpointPreview({ ...baseInput, queryString: '' })).toBe(
      '/api/v1/core/functions/get-branches',
    );
    expect(buildEndpointPreview({ ...baseInput, queryString: '   ' })).toBe(
      '/api/v1/core/functions/get-branches',
    );
    expect(buildEndpointPreview({ ...baseInput, queryString: '?' })).toBe(
      '/api/v1/core/functions/get-branches',
    );
  });

  it('appends the query string on top of a loaded info href too', () => {
    expect(
      buildEndpointPreview({
        ...baseInput,
        scope: 'F',
        info: makeInfo('/core/functions/get-branches'),
        queryString: 'x=1',
      }),
    ).toBe('/api/v1/core/functions/get-branches?x=1');
  });
});
