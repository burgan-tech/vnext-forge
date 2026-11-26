/**
 * This package's vitest runs without a DOM (no jsdom / testing-library, and no new dependency is allowed),
 * so the components are checked through static markup and their pure seams: the suggest function, the
 * suggestion rows, the key handling and the scroll sync the components use.
 */
import { createElement, type ReactElement } from 'react';
import { FormReadOnlyProvider } from './FormReadOnlyContext.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ExpressionInput,
  ExpressionTextarea,
  SuggestionList,
  expressionSuggest,
  keyAction,
  opensAt,
  rowsOf,
  syncScroll,
  type ExpressionFieldProps,
} from './ExpressionInput.js';

const noop = () => undefined;
const schema = { type: 'object', properties: { amount: { type: 'number' } } };

type Over = Omit<Partial<ExpressionFieldProps>, 'mode' | 'suggest'>;
const base = { value: '', onChange: noop, mode: 'expression' as const, ariaLabel: 'e' };
const html = (el: ReactElement) => renderToStaticMarkup(el);
const input = (over: Over) => html(createElement(ExpressionInput, { ...base, ...over }));
const pathInput = (over: Over) =>
  html(createElement(ExpressionInput, { ...base, ...over, mode: 'path', suggest: () => null }));
const textarea = (over: Over & { minRows?: number }) => html(createElement(ExpressionTextarea, { ...base, ...over }));

// Type-level: path mode needs its own suggest (tsc fails if the union loses the requirement).
// @ts-expect-error suggest is required in path mode
const pathWithoutSuggest: ExpressionFieldProps = { value: '', onChange: noop, mode: 'path', ariaLabel: 'p' };
void pathWithoutSuggest;

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** `[kind, text]` of every `data-token` span of the mirror, in order. */
const mirrorTokens = (markup: string): [string, string][] =>
  [...markup.matchAll(/<span data-token="([^"]+)"[^>]*>([^<]*)<\/span>/g)].map((m) => [m[1], decode(m[2])]);
const mirrorKinds = (markup: string) => mirrorTokens(markup).map(([k]) => k);
/** The mirror's whole text content. */
const mirrorText = (markup: string) => {
  const m = /<pre[^>]*data-testid="expression-mirror"[^>]*>([\s\S]*?)<\/pre>/.exec(markup);
  return decode((m?.[1] ?? '').replace(/<[^>]+>/g, ''));
};

describe('ExpressionInput', () => {
  it('renders tokens in the mirror', () => {
    const markup = input({ surface: 'condition', value: 'data.a > 1' });
    expect(markup).toContain('aria-hidden="true"');
    expect(mirrorKinds(markup)).toEqual([
      'variable',
      'punctuation',
      'member',
      'whitespace',
      'operator',
      'whitespace',
      'number',
    ]);
  });

  it('keeps the mirror text equal to the field value', () => {
    for (const value of ['', 'data.a > 1', 'headers["x-channel"] == "web"', '"open', 'a  &&  b <c>']) {
      const markup = input({ surface: 'condition', value });
      expect(mirrorText(markup)).toBe(value);
      expect(mirrorTokens(markup).map(([, t]) => t).join('')).toBe(value);
    }
  });

  it('textarea: a trailing newline gets a zero-width tail so the mirror keeps the line', () => {
    const value = 'data.a > 1 &&\n';
    const markup = textarea({ surface: 'condition', value });
    expect(mirrorTokens(markup).map(([, t]) => t).join('')).toBe(value);
    expect(mirrorText(markup)).toBe(`${value}\u200b`);
    expect(mirrorText(textarea({ surface: 'condition', value: 'a\nb' }))).toBe('a\nb');
  });

  it('makes the field text transparent with a visible caret', () => {
    const markup = input({ surface: 'condition', value: 'data' });
    expect(markup).toMatch(/<input[^>]*class="[^"]*text-transparent[^"]*caret-foreground/);
    expect(textarea({ surface: 'condition', value: 'data' })).toMatch(
      /<textarea[^>]*class="[^"]*text-transparent[^"]*caret-foreground/,
    );
  });

  it('suggests variables with kind badges and shows the active description', () => {
    const state = expressionSuggest('condition', schema)('da', 2);
    expect(state?.items[0]).toBe('data');
    const rows = rowsOf(state!.items, 'da', 2, 'condition', 'expression');
    expect(rows[0]).toMatchObject({ item: 'data', kind: 'variable' });
    const markup = html(createElement(SuggestionList, { id: 'l', rows, active: 0, onPick: noop }));
    expect(markup).toMatch(/<li[^>]*data-kind="variable"[^>]*>.*var.*data/);
    const note = /<div[^>]*role="note"[^>]*>([^<]+)<\/div>/.exec(markup);
    expect(note?.[1].trim()).toBeTruthy();
  });

  it('suggests AsDouble after a data member', () => {
    const text = 'data.amount.';
    const state = expressionSuggest('condition', schema)(text, text.length);
    expect(state?.items).toContain('AsDouble()');
    const rows = rowsOf(state!.items, text, text.length, 'condition', 'expression');
    expect(rows.find((r) => r.item === 'AsDouble()')?.kind).toBe('conversion');
    const markup = html(createElement(SuggestionList, { id: 'l', rows, active: 0, onPick: noop }));
    expect(markup).toMatch(/data-kind="conversion"[^>]*>.*AsDouble\(\)/);
  });

  it('describes functions inserted as calls and falls back to field', () => {
    const rows = rowsOf(['sha256()', 'mystery'], 'sh', 2, 'value', 'expression');
    expect(rows[0]).toMatchObject({ kind: 'function' });
    expect(rows[1]).toEqual({ item: 'mystery', kind: 'field' });
    expect(rowsOf(['$.url'], '$.u', 3, 'taskInput', 'path')).toEqual([{ item: '$.url', kind: 'field' }]);
  });

  it('inserts a slot function with the caret inside the parentheses', () => {
    const state = expressionSuggest('value', schema)('sh', 2);
    expect(state?.apply('sha256()')).toEqual({ text: 'sha256()', caret: 7 });
  });

  it('no suggestions inside a string', () => {
    const text = 'headers["x-';
    expect(expressionSuggest('condition', schema)(text, text.length)).toBeNull();
  });

  it('shows the diagnostic line', () => {
    const markup = input({ surface: 'eventInput', value: 'data.x' });
    const line = /<p[^>]*data-testid="expression-diagnostic"[^>]*>([^<]*)<\/p>/.exec(markup);
    expect(decode(line?.[1] ?? '')).toContain('`data` is not available here');
    expect(markup).toMatch(/<span data-diagnostic=""[^>]*><span data-token="unknownRoot"/);
    expect(markup).not.toContain('aria-invalid');
    expect(input({ surface: 'condition', value: 'data.x' })).not.toContain('expression-diagnostic');
  });

  it('keyboard contract: Enter inserts with list open, commits with list closed', () => {
    expect(keyAction('Enter', true, false)).toBe('insert');
    expect(keyAction('Tab', true, false)).toBe('insert');
    expect(keyAction('ArrowDown', true, false)).toBe('next');
    expect(keyAction('ArrowUp', true, false)).toBe('prev');
    expect(keyAction('Escape', true, false)).toBe('close');
    expect(keyAction('Enter', false, false)).toBe('commit');
    expect(keyAction('Tab', false, false)).toBeNull();
    expect(keyAction('ArrowDown', false, false)).toBeNull();
  });

  it('textarea: Enter adds a newline when the list is closed', () => {
    expect(keyAction('Enter', false, true)).toBeNull();
    expect(keyAction('Enter', true, true)).toBe('insert');
  });

  it('syncs mirror scroll with the field', () => {
    const mirror = { scrollLeft: 0, scrollTop: 0 };
    syncScroll({ scrollLeft: 40, scrollTop: 12 }, mirror);
    expect(mirror).toEqual({ scrollLeft: 40, scrollTop: 12 });
    syncScroll({ scrollLeft: 40, scrollTop: 12 }, null);
  });

  it('path mode highlights a path', () => {
    const markup = pathInput({ value: '$.customer.name' });
    expect(mirrorKinds(markup)).toEqual(['root', 'punctuation', 'segment', 'punctuation', 'segment']);
    expect(markup).not.toContain('expression-diagnostic');
  });

  it('marks the field invalid only through the invalid prop', () => {
    expect(input({ surface: 'condition', value: 'x', invalid: true })).toContain('aria-invalid="true"');
  });

  it('textarea: the list stays closed on an empty token, so Enter is a newline', () => {
    for (const text of ['a &&\n', '', 'a > 1 && ', 'a &&']) {
      expect(opensAt(text, text.length, true)).toBe(false);
      expect(keyAction('Enter', opensAt(text, text.length, true), true)).toBeNull();
    }
    expect(opensAt('a &&\nda', 8, true)).toBe(true);
    expect(opensAt('data.', 5, true)).toBe(true);
    expect(opensAt('"open ', 6, true)).toBe(false);
  });

  it('single line keeps opening on an empty token, as SuggestInput does', () => {
    expect(opensAt('', 0, false)).toBe(true);
    expect(opensAt('a && ', 5, false)).toBe(true);
  });

  it('honours readOnly and FormReadOnlyContext', () => {
    expect(input({ surface: 'condition', value: 'data', readOnly: true })).toMatch(/<input[^>]*readOnly=""/);
    const underContext = (el: ReactElement) => html(createElement(FormReadOnlyProvider, null, el));
    expect(underContext(createElement(ExpressionTextarea, { ...base, surface: 'condition' }))).toMatch(
      /<textarea[^>]*readOnly=""/,
    );
    expect(underContext(createElement(ExpressionInput, { ...base, surface: 'condition' }))).toMatch(
      /<input[^>]*readOnly=""/,
    );
    expect(input({ surface: 'condition', value: 'data' })).not.toMatch(/readOnly/i);
  });

  it('does not flag unknown roots without a surface', () => {
    const markup = input({ value: 'foo.bar > 1' });
    expect(mirrorKinds(markup)).not.toContain('unknownRoot');
    expect(mirrorKinds(markup)[0]).toBe('variable');
    expect(markup).not.toContain('data-diagnostic');
    expect(markup).not.toContain('expression-diagnostic');
    expect(textarea({ value: 'foo' })).not.toContain('unknownRoot');
  });

  it('colours every token kind with a class that has a dark-theme value', () => {
    const markup = input({ surface: 'condition', value: 'x == 1 && "s" != null' });
    expect(markup).toMatch(/data-token="number" class="text-trigger-auto"/);
    expect(markup).not.toContain('filetype-');
  });
});
