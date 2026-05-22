const URN_PREFIX = 'urn:amorphie:res:';

export interface DataSchemaRef {
  key: string;
  domain?: string;
}

/**
 * Parses a `dataSchema` reference string (URN, URL, or bare key).
 *
 * - **URN**: `urn:amorphie:res:schema:{domain}:{key}[:{version}]` — returns `{ domain: parts[1], key: parts[2] }`; optional version suffix is ignored.
 * - **URL**: `https://schemas.vnext.com/{domain}/{key}.json` (any `http:` / `https:` URL with `{domain}/{key}` path) — parses pathname; last segment yields key (`.json` stripped), penultimate yields domain.
 * - **Plain key**: otherwise the trimmed string is the key (no domain).
 */
export function parseDataSchemaRef(input: string | null | undefined): DataSchemaRef | null {
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

    if (!typeSegment || typeSegment !== 'schema' || !domain || !key) return null;

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
