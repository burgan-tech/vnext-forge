/**
 * Highlighted inputs for Dynamic Expresso expressions and mapping paths. The field keeps a native
 * `<input>` / `<textarea>` (transparent text, visible caret and selection) under an `aria-hidden` mirror
 * that draws the same text tokenized and coloured; both share font, size, padding, border width,
 * line-height and wrapping so they stay aligned, and the mirror follows the field's scroll. Diagnostics are
 * advisory: a wavy underline and one line below the field, never `aria-invalid`.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import { cn } from '../lib/utils/cn.js';
import { useFormReadOnly } from './FormReadOnlyContext.js';
import { describe, type CatalogEntry, type EntryKind, type ExpressionSurface } from '../modules/expressions/expressionCatalog.js';
import { suggestionsFor } from '../modules/expressions/suggestionsFor.js';
import {
  diagnoseExpression,
  tokenizeExpression,
  tokenizePath,
  type ExpressionDiagnostic,
} from '../modules/expressions/tokenizeExpression.js';
import {
  expressionTokenAt,
  insertExpressionItem,
  type CompletionContext,
} from '../modules/save-component/declarative-mapping/declarativeMappingCompletions.js';
import type { SuggestFn, SuggestState } from '../modules/save-component/declarative-mapping/SuggestInput.js';

interface ExpressionFieldBase {
  value: string;
  onChange: (next: string) => void;
  /** Single line: fires on Enter (list closed) and blur. Textarea: fires on blur. */
  onCommit?: () => void;
  /** The expression surface: variables, completions and diagnostics. Without it nothing is flagged. */
  surface?: ExpressionSurface;
  schemaRoot?: unknown;
  completionContext?: CompletionContext;
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
  /** No editing and no suggestion list; defaults to `FormReadOnlyContext`, like `Textarea`. */
  readOnly?: boolean;
  className?: string;
}

/**
 * `expression` highlights and completes Dynamic Expresso (`suggest` overrides the surface's completions);
 * `path` highlights a `$.a.b` path and needs its own `suggest`.
 */
export type ExpressionFieldProps = ExpressionFieldBase &
  ({ mode: 'expression'; suggest?: SuggestFn } | { mode: 'path'; suggest: SuggestFn });

/* ────────────── Pure seams (unit-tested) ────────────── */

/** Completions of `surface` at the caret, applied with `insertExpressionItem`. */
export function expressionSuggest(
  surface: ExpressionSurface,
  schemaRoot: unknown,
  context?: CompletionContext,
): SuggestFn {
  return (text, caret) => {
    const token = expressionTokenAt(text, caret);
    if (!token) return null;
    const items = suggestionsFor(surface, token, schemaRoot, context).filter((i) => i !== token.query);
    return items.length > 0 ? { items, apply: (item) => insertExpressionItem(text, token, caret, item) } : null;
  };
}

export interface SuggestionRow {
  item: string;
  kind: EntryKind;
  description?: string;
}

/** `sha256()` → `sha256`, `hasRole("")` → `hasRole`. */
const stripCall = (item: string) => item.replace(/\((?:"")?\)$/, '');

function lookup(root: string | null, item: string, surface: ExpressionSurface): CatalogEntry | undefined {
  const found = describe(root, item, surface);
  if (found) return found;
  const bare = stripCall(item);
  return bare === item ? undefined : describe(root, bare, surface);
}

/** Kind and description of each suggestion, looked up in the catalog after the chain at the caret; else `field`. */
export function rowsOf(
  items: readonly string[],
  text: string,
  caret: number,
  surface: ExpressionSurface | undefined,
  mode: ExpressionFieldProps['mode'],
): SuggestionRow[] {
  const token = mode === 'expression' && surface ? expressionTokenAt(text, caret) : null;
  const chain = token ? token.chain : [];
  // Members are described only directly after a root (`user.`); deeper chains (`data.user.`) are data paths,
  // so '' (never a variable) leaves just conversions, functions and statics.
  const root = chain.length === 0 ? null : chain.length === 1 ? chain[0] : '';
  return items.map((item) => {
    const entry = token && surface ? lookup(root, item, surface) : undefined;
    return entry ? { item, kind: entry.kind, description: entry.description } : { item, kind: 'field' };
  });
}

export type KeyAction = 'next' | 'prev' | 'insert' | 'close' | 'commit' | null;

/** The keyboard contract: with the list open ↑/↓ move, Enter/Tab insert, Esc closes; else single-line Enter commits. */
export function keyAction(key: string, listOpen: boolean, multiline: boolean): KeyAction {
  if (listOpen) {
    if (key === 'ArrowDown') return 'next';
    if (key === 'ArrowUp') return 'prev';
    if (key === 'Enter' || key === 'Tab') return 'insert';
    if (key === 'Escape') return 'close';
  }
  return key === 'Enter' && !multiline ? 'commit' : null;
}

/**
 * Whether the list may open at the caret. A textarea keeps it closed on an empty token (an empty box, after
 * whitespace, an operator or a line break) so Enter stays a newline; the single-line input opens there as
 * `SuggestInput` does today.
 */
export function opensAt(text: string, caret: number, multiline: boolean): boolean {
  if (!multiline) return true;
  const token = expressionTokenAt(text, caret);
  return token !== null && (token.query !== '' || token.chain.length > 0);
}

interface Scrollable {
  scrollLeft: number;
  scrollTop: number;
}

export function syncScroll(field: Scrollable, mirror: Scrollable | null): void {
  if (!mirror) return;
  mirror.scrollLeft = field.scrollLeft;
  mirror.scrollTop = field.scrollTop;
}

/* ────────────── Suggestions hook ────────────── */

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

interface Suggestions extends SuggestState {
  rows: SuggestionRow[];
}

/** The `SuggestInput` list and keyboard behaviour, shared by both fields. */
function useSuggestions(
  props: ExpressionFieldProps,
  multiline: boolean,
  readOnly: boolean,
  fieldRef: RefObject<FieldElement | null>,
  mirrorRef: RefObject<HTMLPreElement | null>,
) {
  const { onChange, onCommit, mode, surface, suggest, schemaRoot, completionContext } = props;
  const [state, setState] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(0);
  const rows = state?.rows ?? [];

  const suggestFn = useMemo<SuggestFn | null>(
    () =>
      readOnly
        ? null
        : (suggest ??
          (mode === 'expression' && surface ? expressionSuggest(surface, schemaRoot, completionContext) : null)),
    [readOnly, suggest, mode, surface, schemaRoot, completionContext],
  );

  const sync = () => {
    if (fieldRef.current) syncScroll(fieldRef.current, mirrorRef.current);
  };

  const refresh = (text: string, caret: number) => {
    const next = opensAt(text, caret, multiline) ? (suggestFn?.(text, caret) ?? null) : null;
    setState(next ? { ...next, rows: rowsOf(next.items, text, caret, surface, mode) } : null);
    setActive(0);
    requestAnimationFrame(sync);
  };

  const insert = (item: string) => {
    const el = fieldRef.current;
    if (!el || !state) return;
    const { text, caret } = state.apply(item);
    onChange(text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
      refresh(text, caret);
    });
  };

  const caretOf = (el: FieldElement) => el.selectionStart ?? el.value.length;

  const handlers = {
    onChange: (e: { target: FieldElement }) => {
      onChange(e.target.value);
      refresh(e.target.value, caretOf(e.target));
    },
    onFocus: (e: { currentTarget: FieldElement }) => refresh(e.currentTarget.value, e.currentTarget.selectionStart ?? 0),
    onClick: (e: { currentTarget: FieldElement }) => refresh(e.currentTarget.value, e.currentTarget.selectionStart ?? 0),
    onScroll: sync,
    onKeyUp: (e: KeyboardEvent<FieldElement>) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        refresh(e.currentTarget.value, e.currentTarget.selectionStart ?? 0);
      }
    },
    onBlur: () => {
      setTimeout(() => setState(null), 120);
      onCommit?.();
    },
    onKeyDown: (e: KeyboardEvent<FieldElement>) => {
      const action = keyAction(e.key, rows.length > 0, multiline);
      if (action === null || (action === 'commit' && !onCommit)) return;
      e.preventDefault();
      if (action === 'next') setActive((i) => (i + 1) % rows.length);
      else if (action === 'prev') setActive((i) => (i - 1 + rows.length) % rows.length);
      else if (action === 'insert') insert(rows[active].item);
      else if (action === 'close') setState(null);
      else onCommit?.();
    },
  };

  return { rows, active, insert, handlers };
}

/* ────────────── Rendering ────────────── */

const TOKEN_CLASS: Record<string, string> = {
  variable: 'text-info-text',
  unknownRoot: 'text-destructive-text',
  member: 'text-foreground',
  call: 'text-warning-text',
  string: 'text-success-text',
  number: 'text-trigger-auto',
  keyword: 'text-trigger-event',
  operator: 'text-muted-foreground',
  punctuation: 'text-muted-foreground',
  whitespace: '',
  // path mode
  root: 'text-info-text',
  segment: 'text-foreground',
  index: 'text-success-text',
};

const KIND_BADGE: Record<EntryKind, string> = {
  variable: 'var',
  field: 'field',
  member: 'member',
  function: 'fn',
  conversion: 'conv',
  static: 'static',
};

/** Shared by field and mirror so the two lay text out identically. */
const TEXT_METRICS = 'font-mono [font-variant-ligatures:none] border rounded-md';
/** The block editor's input size; the textarea keeps today's `font-mono text-xs` expression boxes. */
const SINGLE_BOX = 'text-[11px] leading-[18px] px-2 py-1';
const MULTI_BOX = 'text-xs leading-5 px-3 py-2 whitespace-pre-wrap break-words';

const SINGLE_FIELD =
  'w-full bg-muted-surface text-transparent caret-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all placeholder:text-subtle';
const MULTI_FIELD =
  'w-full resize-none overflow-hidden bg-primary text-transparent caret-foreground shadow-none outline-none placeholder:text-primary-icon/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:bg-primary-hover transition-[background-color,border-color] duration-200 ease-out';

function borderClass(invalid: boolean | undefined, multiline: boolean): string {
  if (invalid) return 'border-destructive-border';
  return multiline
    ? 'border-primary-border hover:border-primary-border-hover focus-visible:border-primary-border-hover'
    : 'border-border focus:border-primary-border';
}

/** Expression tokens; without a surface no root is flagged (an unknown root reads as a variable). */
function expressionTokens(value: string, surface: ExpressionSurface | undefined): { start: number; end: number; kind: string }[] {
  if (surface) return tokenizeExpression(value, surface);
  return tokenizeExpression(value, 'condition').map((t) => (t.kind === 'unknownRoot' ? { ...t, kind: 'variable' } : t));
}

function Mirror({
  value,
  mode,
  surface,
  multiline,
  diagnostics,
  mirrorRef,
}: {
  value: string;
  mode: ExpressionFieldProps['mode'];
  surface: ExpressionSurface | undefined;
  multiline: boolean;
  diagnostics: readonly ExpressionDiagnostic[];
  mirrorRef: RefObject<HTMLPreElement | null>;
}) {
  const tokens = mode === 'path' ? tokenizePath(value) : expressionTokens(value, surface);
  return (
    <pre
      ref={mirrorRef}
      aria-hidden="true"
      data-testid="expression-mirror"
      className={cn(
        TEXT_METRICS,
        multiline ? MULTI_BOX : SINGLE_BOX,
        'pointer-events-none m-0 overflow-hidden border-transparent bg-transparent',
        multiline ? '[grid-area:1/1]' : 'absolute inset-0 whitespace-pre',
      )}>
      {tokens.map((t) => {
        const flagged = diagnostics.some((d) => d.start < t.end && d.end > t.start);
        const span = (
          <span key={t.start} data-token={t.kind} className={TOKEN_CLASS[t.kind]}>
            {value.slice(t.start, t.end)}
          </span>
        );
        return flagged ? (
          <span
            key={t.start}
            data-diagnostic=""
            className="decoration-destructive-text underline decoration-wavy underline-offset-2">
            {span}
          </span>
        ) : (
          span
        );
      })}
      {multiline && value.endsWith('\n') && <span data-mirror-tail="">{'\u200b'}</span>}
    </pre>
  );
}

/** The suggestion list: a kind badge per row and the active row's description in a footer. */
export function SuggestionList({
  id,
  rows,
  active,
  onPick,
}: {
  id: string;
  rows: readonly SuggestionRow[];
  active: number;
  onPick: (item: string) => void;
}) {
  const description = rows[active]?.description;
  return (
    <div className="border-border bg-surface absolute right-0 left-0 z-20 mt-0.5 overflow-hidden rounded-lg border shadow-md">
      <ul id={id} role="listbox" className="max-h-48 overflow-y-auto py-1">
        {rows.map((row, i) => (
          <li
            key={row.item}
            role="option"
            aria-selected={i === active}
            data-kind={row.kind}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(row.item);
            }}
            className={`flex cursor-pointer items-center gap-2 px-2.5 py-1 font-mono text-[11px] ${i === active ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>
            <span className="bg-muted-surface text-muted-foreground w-10 shrink-0 rounded px-1 text-center font-sans text-[9px] uppercase">
              {KIND_BADGE[row.kind]}
            </span>
            <span className="truncate">{row.item}</span>
          </li>
        ))}
      </ul>
      {description && (
        <div role="note" className="border-border text-muted-foreground border-t px-2.5 py-1 text-[10px]">
          {description}
        </div>
      )}
    </div>
  );
}

function ExpressionField({
  props,
  multiline,
  minRows,
}: {
  props: ExpressionFieldProps;
  multiline: boolean;
  minRows?: number;
}) {
  const { value, mode, surface, placeholder, ariaLabel, invalid, className } = props;
  const contextReadOnly = useFormReadOnly();
  const readOnly = props.readOnly ?? contextReadOnly;
  const fieldRef = useRef<FieldElement>(null);
  const mirrorRef = useRef<HTMLPreElement>(null);
  const listId = useId();
  const { rows, active, insert, handlers } = useSuggestions(props, multiline, readOnly, fieldRef, mirrorRef);

  const diagnostics = useMemo(
    () => (mode === 'expression' && surface ? diagnoseExpression(value, surface) : []),
    [mode, surface, value],
  );

  const common = {
    value,
    placeholder,
    readOnly,
    spellCheck: false,
    'aria-label': ariaLabel,
    'aria-invalid': invalid ? true : undefined,
    'aria-autocomplete': 'list' as const,
    'aria-controls': rows.length > 0 ? listId : undefined,
    ...handlers,
  };
  const fieldClass = cn(
    TEXT_METRICS,
    multiline ? MULTI_BOX : SINGLE_BOX,
    multiline ? MULTI_FIELD : SINGLE_FIELD,
    borderClass(invalid, multiline),
    readOnly && 'cursor-default focus:ring-0 focus-visible:ring-0',
  );

  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <div className={multiline ? 'grid' : 'relative'}>
        {multiline ? (
          <textarea
            ref={fieldRef as RefObject<HTMLTextAreaElement>}
            rows={minRows ?? 3}
            className={cn(fieldClass, '[grid-area:1/1]')}
            {...common}
          />
        ) : (
          <input ref={fieldRef as RefObject<HTMLInputElement>} type="text" className={fieldClass} {...common} />
        )}
        <Mirror
          value={value}
          mode={mode}
          surface={surface}
          multiline={multiline}
          diagnostics={diagnostics}
          mirrorRef={mirrorRef}
        />
      </div>
      {rows.length > 0 && <SuggestionList id={listId} rows={rows} active={active} onPick={insert} />}
      {diagnostics.length > 0 && (
        <p data-testid="expression-diagnostic" className="text-warning-text mt-0.5 text-[10px]">
          {diagnostics[0].message}
        </p>
      )}
    </div>
  );
}

/** Single-line highlighted expression or path input. */
export function ExpressionInput(props: ExpressionFieldProps) {
  return <ExpressionField props={props} multiline={false} />;
}

/** Multi-line highlighted expression input; grows with its content from `minRows` (default 3). */
export function ExpressionTextarea(props: ExpressionFieldProps & { minRows?: number }) {
  return <ExpressionField props={props} multiline minRows={props.minRows} />;
}
