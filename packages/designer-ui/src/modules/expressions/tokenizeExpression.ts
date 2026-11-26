/**
 * Single-pass scanner for Dynamic Expresso expressions: feeds syntax highlighting and advisory
 * diagnostics. It never throws and its tokens always cover the whole text.
 */
import { functionsOf, variablesOf, type ExpressionSurface } from './expressionCatalog';

export type TokenKind =
  | 'variable'
  | 'unknownRoot'
  | 'member'
  | 'call'
  | 'string'
  | 'number'
  | 'operator'
  | 'keyword'
  | 'punctuation'
  | 'whitespace';

export interface Token {
  start: number;
  end: number;
  kind: TokenKind;
}

export type PathTokenKind = 'root' | 'segment' | 'index' | 'punctuation';

export interface ExpressionDiagnostic {
  start: number;
  end: number;
  message: string;
}

interface ScanToken extends Token {
  closed?: boolean;
}

const KEYWORDS = new Set(['true', 'false', 'null', 'new', 'typeof', 'is', 'as']);
const TWO_CHAR_OPERATORS = new Set(['=>', '==', '!=', '<=', '>=', '&&', '||', '??']);
const OPERATOR_CHARS = '+-*/%<>=!&|?:^~';
const PUNCTUATION_CHARS = '.,()[]{};';

const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string) => /\w/.test(c);
const isDigit = (c: string) => c >= '0' && c <= '9';
const isSpace = (c: string) => /\s/.test(c);

function scan(text: string, surface: ExpressionSurface): ScanToken[] {
  const variables = new Set(variablesOf(surface).map((e) => e.name));
  const functions = new Set(functionsOf(surface).map((e) => e.name));
  const lambdaParams = new Set<string>();
  for (const m of text.matchAll(/([A-Za-z_]\w*)\s*=>/g)) lambdaParams.add(m[1]);

  const tokens: ScanToken[] = [];
  const n = text.length;
  let i = 0;
  let afterDot: boolean = false;

  const push = (start: number, end: number, kind: TokenKind, closed?: boolean) => {
    tokens.push(closed === undefined ? { start, end, kind } : { start, end, kind, closed });
    i = end;
  };

  while (i < n) {
    const c = text[i];
    const wasAfterDot: boolean = afterDot;
    afterDot = false;

    if (isSpace(c)) {
      afterDot = wasAfterDot;
      let j = i + 1;
      while (j < n && isSpace(text[j])) j++;
      push(i, j, 'whitespace');
    } else if (c === '"') {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (text[j] === '\\') j += 2;
        else if (text[j] === '"') {
          j++;
          closed = true;
          break;
        } else j++;
      }
      push(i, Math.min(j, n), 'string', closed);
    } else if (isDigit(c)) {
      let j = i + 1;
      while (j < n && (isDigit(text[j]) || (text[j] === '.' && isDigit(text[j + 1] ?? '')))) j++;
      while (j < n && /[A-Za-z]/.test(text[j])) j++;
      push(i, j, 'number');
    } else if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentPart(text[j])) j++;
      const name = text.slice(i, j);
      const isCall = text[j] === '(';
      let kind: TokenKind;
      if (wasAfterDot) kind = isCall ? 'call' : 'member';
      else if (KEYWORDS.has(name)) kind = 'keyword';
      else if (isCall) kind = 'call';
      else if (variables.has(name) || functions.has(name)) kind = 'variable';
      else if (/^[A-Z]/.test(name) || lambdaParams.has(name)) kind = 'variable';
      else kind = 'unknownRoot';
      push(i, j, kind);
    } else if (OPERATOR_CHARS.includes(c)) {
      push(i, TWO_CHAR_OPERATORS.has(text.slice(i, i + 2)) ? i + 2 : i + 1, 'operator');
    } else {
      afterDot = c === '.';
      push(i, i + 1, 'punctuation');
    }
  }
  return tokens;
}

/* ────────────── Memoized public tokenizer ────────────── */

const CACHE_LIMIT = 200;
const cache = new Map<string, Token[]>();

/** Memoized per `(surface, text)`; the returned array is shared, callers must not mutate it. */
export function tokenizeExpression(text: string, surface: ExpressionSurface): Token[] {
  const key = `${surface}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tokens: Token[] = scan(text, surface).map(({ start, end, kind }) => ({ start, end, kind }));
  cache.set(key, tokens);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return tokens;
}

/* ────────────── Diagnostics ────────────── */

export function diagnoseExpression(text: string, surface: ExpressionSurface): ExpressionDiagnostic[] {
  const diagnostics: ExpressionDiagnostic[] = [];
  const names = variablesOf(surface).map((e) => e.name);
  for (const t of scan(text, surface)) {
    if (t.kind === 'unknownRoot') {
      diagnostics.push({
        start: t.start,
        end: t.end,
        message: `\`${text.slice(t.start, t.end)}\` is not available here. Variables: ${names.join(', ')}.`,
      });
    } else if (t.kind === 'string' && t.closed === false) {
      diagnostics.push({ start: t.start, end: t.end, message: 'The string is not closed.' });
    }
  }
  return diagnostics;
}

/* ────────────── Path tokenizer ────────────── */

export function tokenizePath(text: string): { start: number; end: number; kind: PathTokenKind }[] {
  const tokens: { start: number; end: number; kind: PathTokenKind }[] = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    let end = i + 1;
    let kind: PathTokenKind = 'punctuation';
    if (c === '$' && i === 0) {
      kind = 'root';
    } else if (c === '[') {
      kind = 'index';
      let inString = false;
      while (end < n) {
        const d = text[end];
        if (inString && d === '\\') end++;
        else if (d === '"') inString = !inString;
        else if (d === ']' && !inString) {
          end++;
          break;
        }
        end++;
      }
      end = Math.min(end, n);
    } else if (isIdentStart(c)) {
      kind = 'segment';
      while (end < n && isIdentPart(text[end])) end++;
    }
    tokens.push({ start: i, end, kind });
    i = end;
  }
  return tokens;
}
