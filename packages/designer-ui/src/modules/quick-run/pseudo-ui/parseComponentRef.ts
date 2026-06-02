/**
 * Parses a pseudo-ui nested `Component.ref` value into a structured
 * reference. Mirrors `parseDataSchemaRef` so component + schema URN
 * handling stays symmetric:
 *
 *   - **URN**: `urn:amorphie:res:component:{domain}:{key}[:{version}]`
 *     → `{ domain, key }` (version suffix ignored).
 *   - **URL**: `https://components.vnext.com/{domain}/{key}.json` (any
 *     http(s) URL whose path ends `…/{domain}/{key}` or
 *     `…/{domain}/{key}.json`) → `{ domain, key }`.
 *   - **Bare key**: the trimmed string is the `key` (no `domain`).
 *
 * Returns `null` for empty / undefined / unparseable input so the
 * delegate's `loadComponent` impl can surface a clear miss.
 */

const URN_PREFIX = 'urn:amorphie:res:';

export interface ComponentRef {
  key: string;
  domain?: string;
}

export function parseComponentRef(input: string | null | undefined): ComponentRef | null {
  if (input == null) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(URN_PREFIX)) {
    const rest = trimmed.slice(URN_PREFIX.length);
    const parts = rest.split(':').map((p) => p.trim());
    if (parts.length < 3) return null;

    const typeSegment = parts[0];
    const domain = parts[1];
    const key = parts[2];

    if (!typeSegment || typeSegment !== 'component' || !domain || !key) return null;

    return { key, domain };
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length < 2) return null;

      const domain = segments[segments.length - 2];
      const last = segments[segments.length - 1] ?? '';
      const key = last.endsWith('.json') ? last.slice(0, -'.json'.length) : last;

      if (!domain || !key) return null;

      return { key, domain };
    } catch {
      return null;
    }
  }

  return { key: trimmed };
}
