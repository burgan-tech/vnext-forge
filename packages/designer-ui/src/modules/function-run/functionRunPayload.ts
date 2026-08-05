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
  /**
   * Free-text query string from the runner's dedicated query input (e.g.
   * `a=1&b=2`, optionally with a leading `?`). Applies to every verb — a
   * function can legitimately take both a body and query parameters, not
   * only the body-less ones. Required, not optional: every call site must
   * decide what "nothing typed" means (`''`) instead of the field being
   * silently absent and reintroducing that ambiguity.
   */
  queryString: string;
}

export interface InvokeRequest {
  body?: string;
  contentType?: string;
  query?: Record<string, string>;
}

/**
 * Whether `verb` sends a request body at all.
 *
 * Matches `function-run.service.ts`'s own `sendsBody` check one-for-one:
 * POST/PATCH do, GET/DELETE do not. Exported so the input pane can decide
 * whether to render the payload editor using this exact rule, rather than
 * re-deriving "GET and DELETE carry no body" a second time in the UI and
 * risking the two disagreeing about a verb the other one has already been
 * taught about.
 */
export function carriesBody(verb: FunctionVerb): boolean {
  return verb === 'POST' || verb === 'PATCH';
}

/**
 * The mode that actually governs what gets sent, as distinct from the raw
 * `mode` the store remembers.
 *
 * The payload editor is hidden entirely once the selected verb carries no
 * body (see `carriesBody`), so a stored `mode` of `'payload'` left over from
 * an earlier, body-bearing verb selection no longer corresponds to anything
 * rendered on screen. Forcing the effective mode to `'view'` whenever the
 * verb carries no body — regardless of whether a view is actually declared —
 * cannot leak stale payload data into the query string: `viewFormData` is
 * only ever written by the rendered input view, and that view never mounts
 * for a function that declares none, so it stays `{}` in that case too. The
 * stored `mode` itself is left untouched by this — it is a computed
 * override, not a write — so switching back to a body-bearing verb restores
 * exactly what the user had in the payload editor.
 */
export function resolveEffectiveMode(mode: RunMode, verb: FunctionVerb): RunMode {
  return carriesBody(verb) ? mode : 'view';
}

/**
 * Parses a free-text query string — pasted straight from a browser address
 * bar or API docs — into the `Record<string, string>` `functions/invoke`
 * expects. Accepts a leading `?` and ignores it. `URLSearchParams` owns the
 * decoding, so the caller never has to think about encoding.
 */
export function parseQueryString(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  const withoutLeadingMark = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
  const result: Record<string, string> = {};
  if (withoutLeadingMark === '') return result;
  for (const [key, value] of new URLSearchParams(withoutLeadingMark)) {
    if (key === '') continue;
    result[key] = value;
  }
  return result;
}

export interface QueryPair {
  key: string;
  value: string;
}

/**
 * The inverse of `parseQueryString` — turns the Params tab's structured KV
 * table back into a query string.
 *
 * `URLSearchParams` owns the encoding (the same authority `parseQueryString`
 * defers *decoding* to), so this never hand-rolls percent-encoding — special
 * characters, spaces, and `&`/`=` inside a value all come out exactly as
 * `URLSearchParams` would produce them.
 *
 * An empty-key row is dropped, matching `parseQueryString`'s own
 * `if (key === '') continue` — a row nobody has typed a key into yet has
 * nothing to contribute to the wire request either way, on either side of
 * this round trip. Duplicate keys are *preserved* in the string itself
 * (`.append`, not `.set`) — collapsing them here would be a second, silent
 * place where "last value wins" happens. `parseQueryString` already collapses
 * a repeated key to its last value when the string is eventually parsed
 * (e.g. by `buildInvokeRequest`), so nothing new is lost at send time that
 * `parseQueryString`'s existing contract did not already lose.
 */
export function stringifyQueryPairs(pairs: readonly QueryPair[]): string {
  const search = new URLSearchParams();
  for (const { key, value } of pairs) {
    if (key === '') continue;
    search.append(key, value);
  }
  return search.toString();
}

export type RequestTabId = 'params' | 'headers' | 'body';

/**
 * The request tab that should actually be shown, as distinct from the raw
 * `activeRequestTab` the store remembers — the same computed-override idiom
 * `resolveEffectiveMode` uses just above, and for the same reason.
 *
 * The Body tab does not exist at all once the selected verb carries no body
 * (see `carriesBody` and `FunctionRunRequestTabs`), so a stored tab of
 * `'body'` left over from an earlier, body-bearing verb no longer corresponds
 * to anything rendered on screen. Falling back to `'params'` in that case —
 * without writing the fallback back into the store — means switching back to
 * a body-bearing verb restores the Body tab automatically, the same way
 * `resolveEffectiveMode` restores a body-bearing verb's stored payload mode.
 */
export function resolveEffectiveRequestTab(tab: RequestTabId, verb: FunctionVerb): RequestTabId {
  return tab === 'body' && !carriesBody(verb) ? 'params' : tab;
}

/**
 * Renders one value into the flat string shape query params and
 * form-urlencoded bodies both need. Objects/arrays survive as JSON rather
 * than becoming `"[object Object]"`.
 *
 * Exported so `FunctionRunPayloadEditor`'s form-urlencoded row editor can
 * reuse the exact same encoding `buildInvokeRequest` uses on submit — the
 * two halves of one feature (edit the payload, then send it) must not
 * disagree about how a nested value is stringified.
 */
export function toQueryValue(value: string | number | boolean | object): string {
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
 * `body` is produced only for a body-bearing verb (`carriesBody`), from the
 * active mode's data (view form data or payload) exactly as before — GET and
 * DELETE never carry one, whatever content type happens to be selected.
 *
 * `query` always starts from the explicit query-string input
 * (`parseQueryString(input.queryString)`). For a body-less verb, the active
 * mode's data is merged in underneath it — that is how a declared input view
 * (or a free payload) on a GET function can do anything at all — with the
 * explicit query-string input winning on a key conflict. This mirrors
 * `function-run.service.ts`'s own `invoke`, where an explicit `query` record
 * wins over whatever query string was already embedded in the path.
 *
 * Every optional field is omitted entirely (rather than set to `undefined`)
 * when there is nothing to send, matching `functionsInvokeParams`'s
 * `.optional()` shape one-for-one.
 *
 * Note the verb changes what a `null` means in the *body-bearing* data. JSON
 * bodies keep it, because JSON `null` is a real value (a PATCH sending
 * `{"region": null}` is clearing the field). The query — whether it comes
 * from the explicit input or from a body-less verb's mode data — drops the
 * key instead, because `?region=` asserts an empty string rather than "not
 * specified"; see `toFlatEntries`.
 */
export function buildInvokeRequest(input: InvokeRequestInput): InvokeRequest {
  const bodyBearing = carriesBody(input.verb);
  const source = input.mode === 'view' ? input.viewFormData : input.payload;
  const entries = Object.entries(source ?? {});

  const result: InvokeRequest = {};

  if (bodyBearing && entries.length > 0) {
    if (input.contentType === 'form') {
      const flat = toFlatEntries(entries);
      if (flat.length > 0) {
        const search = new URLSearchParams();
        for (const [key, value] of flat) search.append(key, value);
        result.body = search.toString();
        result.contentType = CONTENT_TYPES.form;
      }
    } else {
      result.body = JSON.stringify(Object.fromEntries(entries));
      result.contentType = CONTENT_TYPES.json;
    }
  }

  const modeQuery = !bodyBearing && entries.length > 0 ? Object.fromEntries(toFlatEntries(entries)) : {};
  const explicitQuery = parseQueryString(input.queryString);
  // Explicit query-string input wins on a key conflict — see the function
  // doc comment for the precedent this matches.
  const mergedQuery = { ...modeQuery, ...explicitQuery };
  if (Object.keys(mergedQuery).length > 0) {
    result.query = mergedQuery;
  }

  return result;
}
