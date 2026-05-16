import { ViewType } from '@vnext-forge-studio/vnext-types';

export function viewTypeToMonacoLanguage(type: number): string {
  switch (type) {
    case ViewType.Html:
      return 'html';
    case ViewType.Markdown:
      return 'markdown';
    case ViewType.Json:
    case ViewType.DeepLink:
    case ViewType.Http:
    case ViewType.URN:
    default:
      return 'json';
  }
}

export function scaffoldContentForViewType(type: number): string {
  switch (type) {
    case ViewType.Html:
    case ViewType.Markdown:
      return '';
    case ViewType.DeepLink:
      return JSON.stringify({ href: '' }, null, 2);
    case ViewType.Http:
      return JSON.stringify({ href: '' }, null, 2);
    case ViewType.URN:
      return JSON.stringify({ urn: '' }, null, 2);
    case ViewType.Json:
    default:
      return '{}';
  }
}

export function normalizeContentForEditor(content: unknown): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }
  return String(content);
}

export function normalizeContentForSave(content: unknown, viewType: number): unknown {
  if (typeof content !== 'string') return content;
  if (viewType === ViewType.Html || viewType === ViewType.Markdown) return content;
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

export function isContentEmpty(content: unknown): boolean {
  const str = typeof content === 'string' ? content : normalizeContentForEditor(content);
  const trimmed = str.trim();
  if (trimmed === '' || trimmed === '{}' || trimmed === '[]') return true;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      if (keys.length === 1 && (keys[0] === 'href' || keys[0] === 'urn')) {
        return parsed[keys[0]] === '';
      }
    }
  } catch {
    // not JSON
  }
  return false;
}

/**
 * Returns true when the view type uses a structured href/urn field
 * rather than a free-form editor.
 */
export function isLinkType(type: number): boolean {
  return (
    type === ViewType.DeepLink ||
    type === ViewType.Http ||
    type === ViewType.URN
  );
}

/**
 * For DeepLink/Http types the primary key is `href`;
 * for URN the primary key is `urn`.
 */
export function linkTypeFieldKey(type: number): 'href' | 'urn' {
  return type === ViewType.URN ? 'urn' : 'href';
}

