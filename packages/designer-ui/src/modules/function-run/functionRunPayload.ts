import { RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES } from '@vnext-forge-studio/app-contracts';
import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

/**
 * The two media types `runtime-proxy` will forward, keyed for the UI selector.
 *
 * The strings themselves come from `app-contracts` so the client and the proxy
 * cannot drift apart — designer-ui may not import `services-core`, so a local
 * copy would be unlinked from the allowlist that actually enforces this.
 */
export const CONTENT_TYPES = Object.freeze({
  json: RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES[0],
  form: RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES[1],
} as const);

export type ContentTypeId = keyof typeof CONTENT_TYPES;
export type RunMode = 'view' | 'payload';

export interface InvokeRequestInput {
  verb: FunctionVerb;
  mode: RunMode;
  /** Form data lifted out of the rendered input view. */
  viewFormData?: Record<string, unknown> | undefined;
  /** Content of the free payload editor. */
  payload?: Record<string, unknown> | undefined;
  contentType: ContentTypeId;
}

export interface InvokeRequest {
  body?: string;
  contentType?: string;
  query?: Record<string, string>;
}

/**
 * Renders one value into the flat string shape query params and
 * form-urlencoded bodies both need. Objects/arrays survive as JSON rather
 * than becoming `"[object Object]"`.
 */
function toQueryValue(value: string | number | boolean | object): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Drops `null`/`undefined` entries and stringifies the rest for a flat
 * (query or form-urlencoded) encoding.
 *
 * `null` means "no value entered" here, not "send an empty string" — a
 * query string of `?region=` or a form body of `region=` would tell the
 * runtime engine something different from "the caller left this blank".
 * JSON encoding does not go through this path, because JSON's `null` is
 * itself a meaningful value (e.g. "clear this field" on PATCH).
 */
function toFlatEntries(entries: [string, unknown][]): [string, string][] {
  const flat: [string, string][] = [];
  for (const [key, value] of entries) {
    if (value === null || value === undefined) continue;
    flat.push([key, toQueryValue(value as string | number | boolean | object)]);
  }
  return flat;
}

/**
 * Turns the runner's current state into the wire parameters for
 * `functions/invoke`.
 *
 * Kept as one function because the decisions are coupled: GET and DELETE carry
 * no body whatever content type is selected, and the two content types encode
 * the same map differently. Splitting it invites a call site that encodes a
 * body for a verb that cannot send one.
 *
 * Every optional field is omitted entirely (rather than set to `undefined`)
 * when there is nothing to send, matching `functionsInvokeParams`'s `.optional()`
 * shape one-for-one.
 *
 * Note the verb changes what a `null` means. JSON bodies keep it, because JSON
 * `null` is a real value (a PATCH sending `{"region": null}` is clearing the
 * field). Query strings and form bodies drop the key, because `?region=`
 * asserts an empty string rather than "not specified" — see `toFlatEntries`.
 * So the same payload is not identical on the wire across verbs.
 */
export function buildInvokeRequest(input: InvokeRequestInput): InvokeRequest {
  const source = input.mode === 'view' ? input.viewFormData : input.payload;
  const entries = Object.entries(source ?? {});

  if (entries.length === 0) {
    return {};
  }

  const carriesBody = input.verb === 'POST' || input.verb === 'PATCH';
  if (!carriesBody) {
    const flat = toFlatEntries(entries);
    if (flat.length === 0) return {};
    return { query: Object.fromEntries(flat) };
  }

  if (input.contentType === 'form') {
    const flat = toFlatEntries(entries);
    if (flat.length === 0) return {};
    const search = new URLSearchParams();
    for (const [key, value] of flat) search.append(key, value);
    return { body: search.toString(), contentType: CONTENT_TYPES.form };
  }

  return {
    body: JSON.stringify(Object.fromEntries(entries)),
    contentType: CONTENT_TYPES.json,
  };
}
