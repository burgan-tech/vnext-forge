/**
 * Pure read/write helpers for the function contract slots —
 * `attributes.inputView`, `outputView`, `inputSchema`, `outputSchema` —
 * and for `attributes.verbs`.
 *
 * The engine contract accepts each slot in three interchangeable wire
 * shapes (a `oneOf`):
 *
 * ```
 * viewSlot = viewComponentRef | viewRuleEntry[] | { views: viewRuleEntry[] }
 * ```
 *
 * All three are *read*; writes always produce the canonical form — a
 * bare reference for single mode, a flat array for rule mode. The
 * `{ views: [...] }` / `{ schemas: [...] }` wrapper is therefore
 * normalized away the first time the user edits a slot that used it.
 *
 * Everything here is deliberately free of React and of the component
 * store so the JSON-shaping invariants can be unit-tested without
 * rendering (same rationale as `applyCacheMutation` in
 * `FunctionCacheSection`).
 */
import type { VnextExportCategory } from '@vnext-forge-studio/app-contracts';
import {
  FUNCTION_VERBS,
  type ComponentFileRef,
  type FunctionComponentRef,
  type FunctionVerb,
  type ResourceReference,
} from '@vnext-forge-studio/vnext-types';

import type { ScriptCode } from '../code-editor/CodeEditorTypes';

/* ────────────── Slot kinds ────────────── */

export type SlotKind = 'view' | 'schema';

export interface SlotKindConfig {
  /** `flow` stamped onto references authored for this slot. */
  flow: string;
  /**
   * Picker / creator category. Narrowed to the two literals these slots
   * use so it satisfies `CreateNewComponentDialog`'s supported subset as
   * well as the broader {@link VnextExportCategory} the picker takes.
   */
  category: Extract<VnextExportCategory, 'views' | 'schemas'>;
  /** Property holding the reference inside a rule entry. */
  entryKey: 'view' | 'schema';
  /** Only view entries carry `loadData`. */
  hasLoadData: boolean;
  /** Property holding the entry array in the wrapper wire shape. */
  wrapperKey: 'views' | 'schemas';
  /** Singular noun for UI copy, e.g. "view". */
  noun: string;
}

export const SLOT_KINDS: Record<SlotKind, SlotKindConfig> = {
  view: {
    flow: 'sys-views',
    category: 'views',
    entryKey: 'view',
    hasLoadData: true,
    wrapperKey: 'views',
    noun: 'view',
  },
  schema: {
    flow: 'sys-schemas',
    category: 'schemas',
    entryKey: 'schema',
    hasLoadData: false,
    wrapperKey: 'schemas',
    noun: 'schema',
  },
};

/* ────────────── Normalized in-memory shape ────────────── */

export type SlotMode = 'single' | 'rule-based';

/**
 * A rule entry with the kind-specific reference key (`view` / `schema`)
 * normalized to `ref`, so one component can drive both slot kinds.
 */
export interface SlotRuleEntry {
  rule?: ScriptCode;
  ref?: FunctionComponentRef;
  loadData?: boolean;
}

export interface SlotState {
  mode: SlotMode;
  /** Populated in `single` mode. */
  ref: FunctionComponentRef | null;
  /** Populated in `rule-based` mode. */
  entries: SlotRuleEntry[];
  /**
   * True when the stored value matched none of the three wire shapes.
   * The UI must then refuse to rewrite the slot (so nothing is lost)
   * and tell the user to fix the JSON directly.
   */
  unrecognized: boolean;
}

const EMPTY_STATE: SlotState = { mode: 'single', ref: null, entries: [], unrecognized: false };

/* ────────────── Reference predicates ────────────── */

export function isComponentFileRef(value: unknown): value is ComponentFileRef {
  return isPlainObject(value) && typeof value.ref === 'string';
}

function isExplicitRef(value: unknown): value is ResourceReference {
  return isPlainObject(value) && typeof value.key === 'string';
}

function isAnyRef(value: unknown): value is FunctionComponentRef {
  return isComponentFileRef(value) || isExplicitRef(value);
}

/**
 * True when a reference carries nothing worth persisting — an explicit
 * ref with a blank `key`, a file ref with a blank `ref`, or nothing at
 * all. Used to collapse the slot key out of the JSON entirely.
 */
export function isEmptyComponentRef(ref: FunctionComponentRef | null | undefined): boolean {
  if (!ref) return true;
  if (isComponentFileRef(ref)) return ref.ref.trim().length === 0;
  return String(ref.key ?? '').trim().length === 0;
}

/** A blank explicit reference pre-stamped with the slot's `flow`. */
export function emptyComponentRef(kind: SlotKind, domain = ''): ResourceReference {
  return { key: '', domain, version: '1.0.0', flow: SLOT_KINDS[kind].flow };
}

/** Build a reference from a picker / creator result. */
export function refFromDiscoveredComponent(
  kind: SlotKind,
  component: { key: string; version?: string; flow?: string },
  domain: string,
): ResourceReference {
  // Blank strings count as missing, not as a deliberate empty value.
  return {
    key: component.key,
    domain,
    version: component.version?.trim() ? component.version : '1.0.0',
    flow: component.flow?.trim() ? component.flow : SLOT_KINDS[kind].flow,
  };
}

/* ────────────── Read ────────────── */

/**
 * Interpret a raw slot value into {@link SlotState}. Never throws; an
 * uninterpretable value comes back as `unrecognized`.
 */
export function readSlot(kind: SlotKind, value: unknown): SlotState {
  if (value == null) return EMPTY_STATE;

  if (Array.isArray(value)) {
    return { mode: 'rule-based', ref: null, entries: readEntries(kind, value), unrecognized: false };
  }

  if (isPlainObject(value)) {
    const wrapped = value[SLOT_KINDS[kind].wrapperKey];
    if (Array.isArray(wrapped)) {
      return {
        mode: 'rule-based',
        ref: null,
        entries: readEntries(kind, wrapped),
        unrecognized: false,
      };
    }
    if (isAnyRef(value)) {
      return { mode: 'single', ref: value, entries: [], unrecognized: false };
    }
  }

  return { ...EMPTY_STATE, unrecognized: true };
}

function readEntries(kind: SlotKind, raw: unknown[]): SlotRuleEntry[] {
  const { entryKey, hasLoadData } = SLOT_KINDS[kind];
  return raw.map((item) => {
    if (!isPlainObject(item)) return {};
    const entry: SlotRuleEntry = {};
    const ref = item[entryKey];
    if (isAnyRef(ref)) entry.ref = ref;
    if (isPlainObject(item.rule)) entry.rule = item.rule as unknown as ScriptCode;
    if (hasLoadData && typeof item.loadData === 'boolean') entry.loadData = item.loadData;
    return entry;
  });
}

/* ────────────── Write ────────────── */

/**
 * Canonical `single` mode value: the bare reference, or `undefined` when
 * it holds nothing — so the caller drops the slot key rather than
 * persisting `{ key: '' }`.
 */
export function writeSlotSingle(
  ref: FunctionComponentRef | null | undefined,
): FunctionComponentRef | undefined {
  if (isEmptyComponentRef(ref)) return undefined;
  return ref!;
}

/**
 * Canonical `rule-based` mode value: a flat array, or `undefined` when
 * there are no entries.
 *
 * Only the three fields the contract allows (`rule`, the reference, and
 * `loadData` for views) are emitted. Rule entries are
 * `additionalProperties: false`, so any stray key a hand-edited file
 * carried was already blocking validation — normalizing it away on edit
 * fixes the document rather than losing anything meaningful.
 */
export function writeSlotEntries(
  kind: SlotKind,
  entries: SlotRuleEntry[],
): Record<string, unknown>[] | undefined {
  if (entries.length === 0) return undefined;
  const { entryKey, hasLoadData } = SLOT_KINDS[kind];
  return entries.map((entry) => {
    const out: Record<string, unknown> = {};
    if (entry.rule) out.rule = entry.rule;
    out[entryKey] = entry.ref ?? emptyComponentRef(kind);
    if (hasLoadData && entry.loadData) out.loadData = true;
    return out;
  });
}

/* ────────────── Mode switching ────────────── */

/**
 * `single` → `rule-based`: carry the existing reference over as the sole
 * (fallback) entry, so switching mode never silently discards a pick.
 */
export function entriesFromSingle(ref: FunctionComponentRef | null | undefined): SlotRuleEntry[] {
  if (isEmptyComponentRef(ref)) return [];
  return [{ ref: ref! }];
}

/**
 * `rule-based` → `single`: keep the first entry's reference. Rules and
 * any further entries are dropped — that is the meaning of collapsing to
 * a single unconditional reference.
 */
export function singleFromEntries(entries: SlotRuleEntry[]): FunctionComponentRef | null {
  for (const entry of entries) {
    if (!isEmptyComponentRef(entry.ref)) return entry.ref!;
  }
  return null;
}

/* ────────────── Fallback ordering ────────────── */

/** An entry with no `rule` always matches, so it acts as the fallback. */
export function isFallbackEntry(entry: SlotRuleEntry): boolean {
  return !entry.rule;
}

/**
 * Index of the first rule-less entry that is *not* last. Such an entry
 * shadows everything after it. JSON Schema cannot express this ordering
 * constraint, so the editor warns instead. Returns -1 when fine.
 */
export function findShadowingFallbackIndex(entries: SlotRuleEntry[]): number {
  for (let i = 0; i < entries.length - 1; i += 1) {
    if (isFallbackEntry(entries[i])) return i;
  }
  return -1;
}

/* ────────────── Verbs ────────────── */

/** Read `attributes.verbs` defensively, keeping only known verbs. */
export function readVerbs(value: unknown): FunctionVerb[] {
  if (!Array.isArray(value)) return [];
  return FUNCTION_VERBS.filter((verb) => value.includes(verb));
}

/**
 * Canonical `verbs` value: de-duplicated, in declaration order, and
 * `undefined` when empty — the contract sets `minItems: 1`, so an empty
 * array would fail validation whereas an absent key means "no verb
 * restriction".
 */
export function normalizeVerbs(verbs: readonly string[]): FunctionVerb[] | undefined {
  const next = FUNCTION_VERBS.filter((verb) => verbs.includes(verb));
  return next.length > 0 ? [...next] : undefined;
}

/** Toggle one verb on/off, returning the canonical next value. */
export function toggleVerb(
  current: readonly string[],
  verb: FunctionVerb,
  enabled: boolean,
): FunctionVerb[] | undefined {
  const set = new Set(current);
  if (enabled) set.add(verb);
  else set.delete(verb);
  return normalizeVerbs([...set]);
}

/* ────────────── Internals ────────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
