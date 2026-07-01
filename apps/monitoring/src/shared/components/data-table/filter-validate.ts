import { createEmptyFilterRoot } from './filter-eval';
import type { FilterCondition, FilterGroup, FilterNode, FilterableColumn } from './types';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function sanitizeNode(node: unknown, ids: Set<string>): FilterNode | null {
  if (!isObject(node)) return null;

  if (node.kind === 'condition') {
    const c = node as unknown as FilterCondition;
    if (typeof c.columnId !== 'string' || !ids.has(c.columnId)) return null;
    if (typeof c.operator !== 'string' || typeof c.value !== 'string') return null;
    return { kind: 'condition', id: String(c.id ?? ''), columnId: c.columnId, operator: c.operator, value: c.value };
  }

  if (node.kind === 'group') {
    const g = node as unknown as FilterGroup;
    const children = Array.isArray(g.children)
      ? g.children.map((child) => sanitizeNode(child, ids)).filter((x): x is FilterNode => x !== null)
      : [];
    if (children.length === 0) return null;
    return {
      kind: 'group',
      id: String(g.id ?? ''),
      combinator: g.combinator === 'or' ? 'or' : 'and',
      children,
    };
  }

  return null;
}

/**
 * Rebuilds a clean FilterGroup from untrusted input (e.g. a URL-decoded value),
 * dropping conditions that reference columns not in `columns` and pruning groups
 * that become empty. Returns an empty root when the input is unusable.
 */
export function validateFilterGroup(raw: unknown, columns: FilterableColumn[]): FilterGroup {
  const ids = new Set(columns.map((c) => c.id));
  const sanitized = sanitizeNode(raw, ids);
  if (sanitized?.kind !== 'group') return createEmptyFilterRoot();
  // Prune nested groups that ended up empty.
  sanitized.children = sanitized.children.filter(
    (child) => child.kind === 'condition' || child.children.length > 0,
  );
  return sanitized;
}

/**
 * Filters a query-param map down to entries whose base column id (the part
 * before any `[operator]`) exists in `columns`. Returns an empty object for
 * non-object input.
 */
export function validateQueryParamFilters(
  raw: unknown,
  columns: FilterableColumn[],
): Record<string, string> {
  if (!isObject(raw)) return {};
  const ids = new Set(columns.map((c) => c.id));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    const base = key.includes('[') ? key.slice(0, key.indexOf('[')) : key;
    if (ids.has(base)) out[key] = value;
  }
  return out;
}
