import type { FunctionScope } from '@vnext-forge-studio/vnext-types';

import type { FunctionInfo } from './types/functionRun.types';

export interface BuildEndpointPreviewInput {
  info: FunctionInfo | null;
  scope: FunctionScope;
  domain: string;
  functionKey: string;
  workflowKey: string;
  instanceId: string;
  /** Free-text query string, e.g. `a=1&b=2`, optionally with a leading `?`. */
  queryString: string;
}

const API_V1_PREFIX = '/api/v1/';

/**
 * Reimplements `rebaseRuntimeHref` from
 * `packages/services-core/src/services/function-run/function-run-paths.ts` —
 * that is the single source of truth for the actual wire rule, and
 * `designer-ui` may not import `services-core` (see the dependency policy).
 * Keep this copy in step with that one: if the two disagree, the endpoint bar
 * shows a URL that is not the one the request goes to, which is worse than
 * showing nothing.
 *
 * `/info` hrefs are gateway-relative with an unstable prefix (`/core/…` and
 * `/api/core/…` have both been observed), so the domain segment anchors the
 * rebase rather than a prefix being appended — see `rebaseRuntimeHref` for
 * the full rationale.
 */
function rebaseRuntimeHrefForDisplay(href: string, domain: string): string {
  if (!href.startsWith('/')) return href;
  if (domain !== '') {
    const queryIndex = href.indexOf('?');
    const pathOnly = queryIndex === -1 ? href : href.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : href.slice(queryIndex);
    const segments = pathOnly.split('/').filter((segment) => segment !== '');
    const domainIndex = segments.indexOf(domain);
    if (domainIndex !== -1) {
      return `/api/v1/${segments.slice(domainIndex).join('/')}${query}`;
    }
  }
  return href.startsWith(API_V1_PREFIX) ? href : `/api/v1${href}`;
}

/**
 * The scope→route shape `buildFunctionInfoPath` uses (minus its `/info`
 * suffix — this is the *invoke* route, not the discovery one), for display
 * before `/info` has resolved. Missing F/I scope ids render as a named
 * placeholder rather than an empty path segment, so the bar never shows a
 * URL that looks valid but 404s if you paste it.
 */
function fallbackPath(input: BuildEndpointPreviewInput): string {
  const { scope, domain, functionKey, workflowKey, instanceId } = input;
  if (scope === 'D') {
    return `/api/v1/${domain}/functions/${functionKey}`;
  }
  const wf = workflowKey.trim() !== '' ? workflowKey : '{workflowKey}';
  const id = instanceId.trim() !== '' ? instanceId : '{instanceId}';
  return `/api/v1/${domain}/workflows/${wf}/instances/${id}/functions/${functionKey}`;
}

/** Strips a leading `?` (if any) and re-adds exactly one, only when there is something to append. */
function normalizeQueryStringForDisplay(queryString: string): string {
  const trimmed = queryString.trim();
  if (trimmed === '') return '';
  const withoutLeadingMark = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
  if (withoutLeadingMark === '') return '';
  return `?${withoutLeadingMark}`;
}

/**
 * The path the request will actually hit, for display in the endpoint bar.
 *
 * Once `/info` has loaded, `info.function.href` is the truth — it is what
 * `runInvoke` sends verbatim to `functions/invoke` (see
 * `functionRunOrchestration.ts`), so the preview must apply the exact same
 * normalization the wire does or the two will disagree. Before `/info`
 * resolves (or if it never does), the scope→route fallback keeps the bar
 * from ever being empty — this is the same shape `buildFunctionInfoPath`
 * uses for discovery, without the `/info` suffix.
 */
export function buildEndpointPreview(input: BuildEndpointPreviewInput): string {
  const path = input.info
    ? rebaseRuntimeHrefForDisplay(input.info.function.href, input.info.domain)
    : fallbackPath(input);
  return `${path}${normalizeQueryStringForDisplay(input.queryString)}`;
}
