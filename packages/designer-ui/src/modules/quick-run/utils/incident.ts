import type { IncidentEntry } from '../QuickRunApi';

/**
 * One view over both incident shapes the runtime has served:
 * - runtime >= 2026-09-07: `{ hasActiveIncident, active?: {href}, history: {href} }`
 * - older runtimes: `{ hasActiveIncident, totalCount, active?: IncidentEntry, history?: IncidentEntry[] }`
 */
export interface NormalizedIncident {
  hasActiveIncident: boolean;
  /** Embedded active entry — legacy runtimes only. */
  active?: IncidentEntry;
  /** Embedded history — legacy runtimes only; empty for the link shape. */
  history: IncidentEntry[];
  /** Server hrefs — link shape only. Informational; Forge rebuilds paths itself. */
  links?: { active?: string; history?: string };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isEntry(value: unknown): value is IncidentEntry {
  const r = asRecord(value);
  return !!r && typeof r.id === 'string';
}

function hrefOf(value: unknown): string | undefined {
  const href = asRecord(value)?.href;
  return typeof href === 'string' ? href : undefined;
}

export function normalizeIncident(raw: unknown): NormalizedIncident | null {
  const r = asRecord(raw);
  if (!r) return null;

  const active = isEntry(r.active) ? r.active : undefined;
  const history = Array.isArray(r.history) ? r.history.filter(isEntry) : [];
  const activeHref = hrefOf(r.active);
  const historyHref = hrefOf(r.history);

  const result: NormalizedIncident = {
    hasActiveIncident: r.hasActiveIncident === true && !(active?.isResolved ?? false),
    history,
  };
  if (active) result.active = active;
  if (activeHref || historyHref) {
    result.links = {};
    if (activeHref) result.links.active = activeHref;
    if (historyHref) result.links.history = historyHref;
  }
  return result;
}
