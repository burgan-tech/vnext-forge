export type TableFilterMode = 'graphql' | 'query-param';

/**
 * The per-table state carried in the URL. `f` is page-defined and opaque to the
 * codec (FilterGroup, QueryParamFilters, or a composite) — the page interprets
 * and validates it on hydrate. Empty fields are omitted by the encoder.
 */
export interface TableUrlState {
  f?: unknown;
  q?: string;
  s?: { by: string; dir: 'asc' | 'desc' };
  p?: number;
}

const MODE_TAG: Record<TableFilterMode, string> = { graphql: 'g', 'query-param': 'q' };
const VERSION = 1;

// UTF-8 safe base64url (works in browser and node 18+).
function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isEmptyState(state: TableUrlState): boolean {
  return (
    state.f === undefined &&
    !state.q?.trim() &&
    state.s === undefined &&
    (state.p === undefined || state.p === 1)
  );
}

/**
 * Encodes a table-state bundle into a mode-tagged token: "<tag>~<version>~<base64url>".
 * Returns null when the bundle carries nothing effective (caller should delete the param).
 */
export function encodeTableState(mode: TableFilterMode, state: TableUrlState): string | null {
  if (isEmptyState(state)) return null;

  const payload: TableUrlState = {};
  if (state.f !== undefined) payload.f = state.f;
  if (state.q?.trim()) payload.q = state.q;
  if (state.s !== undefined) payload.s = state.s;
  if (state.p !== undefined && state.p !== 1) payload.p = state.p;

  return `${MODE_TAG[mode]}~${VERSION}~${toBase64Url(JSON.stringify(payload))}`;
}

/**
 * Decodes a token back into a bundle. Returns null (silently) on mode-tag
 * mismatch, unknown version, or any decode/parse failure. Does NOT interpret
 * `f` — column validation is the caller's responsibility.
 */
export function decodeTableState(mode: TableFilterMode, token: string): TableUrlState | null {
  if (!token) return null;
  const sep = token.indexOf('~');
  if (sep === -1) return null;
  const tag = token.slice(0, sep);
  if (tag !== MODE_TAG[mode]) return null;

  const rest = token.slice(sep + 1);
  const sep2 = rest.indexOf('~');
  if (sep2 === -1) return null;
  const version = Number(rest.slice(0, sep2));
  if (version !== VERSION) return null;

  const payload = rest.slice(sep2 + 1);
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as TableUrlState;
  } catch {
    return null;
  }
}

/** Reads and decodes the table-state token stored at `tableId` in the given params. */
export function readTableState(
  params: URLSearchParams,
  tableId: string,
  mode: TableFilterMode,
): TableUrlState | null {
  const token = params.get(tableId);
  return token ? decodeTableState(mode, token) : null;
}

/**
 * Returns a NEW URLSearchParams with the `tableId` token set to the encoded
 * state, or removed when the state is empty. All other params are preserved.
 * The input is not mutated.
 */
export function writeTableState(
  params: URLSearchParams,
  tableId: string,
  mode: TableFilterMode,
  state: TableUrlState,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const token = encodeTableState(mode, state);
  if (token) next.set(tableId, token);
  else next.delete(tableId);
  return next;
}
