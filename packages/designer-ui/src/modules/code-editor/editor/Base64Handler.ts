export function encodeToBase64(text: string): string {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return '';
  }
}

export function decodeFromBase64(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return '';
  }
}

export function isBase64(str: string): boolean {
  if (!str || str.length === 0) return false;
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
}

export function extractCsxFromWorkflow(
  workflow: Record<string, unknown>,
  path: string[]
): { decoded: string; location: string } | null {
  let current: any = workflow;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return null;
    }
  }

  if (typeof current === 'string' && isBase64(current)) {
    return { decoded: decodeFromBase64(current), location: path.join('.') };
  }
  return null;
}
