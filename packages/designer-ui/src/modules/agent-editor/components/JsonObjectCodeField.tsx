import { useEffect, useState, type ReactNode } from 'react';
import { WandSparkles } from 'lucide-react';

import { JsonCodeField } from '../../../ui/JsonCodeField';
import { FieldFoot, FieldLabel } from './agentFormPrimitives';

export interface JsonObjectCheck {
  /** Parsed object, or `undefined` for empty text. */
  value?: Record<string, unknown>;
  /** Why the text cannot be stored; `null` when it can. */
  error: string | null;
}

/** `position N` of a `JSON.parse` message → `line L, column C`. */
function locate(text: string, message: string): string {
  const lineCol = /line (\d+) column (\d+)/i.exec(message);
  if (lineCol) return `line ${lineCol[1]}, column ${lineCol[2]}`;
  const pos = /position (\d+)/i.exec(message);
  if (!pos) return '';
  const offset = Number(pos[1]);
  const before = text.slice(0, offset).split('\n');
  return `line ${before.length}, column ${before[before.length - 1].length + 1}`;
}

/** Parses editor text into a JSON object (optionally a `"type": "object"` schema root). */
export function checkJsonObjectText(text: string, requireObjectType = false): JsonObjectCheck {
  if (text.trim() === '') return { error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const where = locate(text, err instanceof Error ? err.message : '');
    return { error: `Invalid JSON${where ? ` at ${where}` : ''}.` };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'Must be a JSON object.' };
  }
  const obj = parsed as Record<string, unknown>;
  if (requireObjectType) {
    if (obj.type !== 'object') return { error: 'The schema root must be "type": "object".' };
    if (obj.properties !== undefined && (obj.properties === null || typeof obj.properties !== 'object' || Array.isArray(obj.properties))) {
      return { error: '"properties" must be an object.' };
    }
    if (obj.required !== undefined && !(Array.isArray(obj.required) && obj.required.every((r) => typeof r === 'string'))) {
      return { error: '"required" must be an array of property names.' };
    }
  }
  return { value: obj, error: null };
}

/**
 * JSON object editor on Forge's Monaco `JsonCodeField` (syntax highlighting,
 * JSON diagnostics). The text stays local while it does not parse; only a
 * valid object is reported, so typing never corrupts the document, and the
 * stored value is the same JSON object as before. Format re-indents valid text.
 */
export function JsonObjectCodeField({
  label,
  hint,
  value,
  onChange,
  height = 240,
  requireObjectType = false,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: unknown;
  onChange: (next: Record<string, unknown> | undefined) => void;
  height?: number;
  /** Require a JSON schema root of `"type": "object"`. */
  requireObjectType?: boolean;
}) {
  const serialized = value === undefined ? '' : JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState<string | null>(null);

  // Adopt outside changes (undo, file reload) unless they are our own echo.
  useEffect(() => {
    setText((current) => {
      const mine = checkJsonObjectText(current, requireObjectType);
      return mine.error === null && JSON.stringify(mine.value ?? null) === JSON.stringify(value ?? null) ? current : serialized;
    });
    setError(null);
  }, [serialized, value, requireObjectType]);

  const edit = (next: string) => {
    setText(next);
    const check = checkJsonObjectText(next, requireObjectType);
    setError(check.error);
    if (check.error === null) onChange(check.value);
  };

  const format = () => {
    const check = checkJsonObjectText(text, requireObjectType);
    if (check.error === null && check.value) setText(JSON.stringify(check.value, null, 2));
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <FieldLabel>{label}</FieldLabel>
        </div>
        <button
          type="button"
          onClick={format}
          disabled={error !== null || text.trim() === ''}
          title="Format JSON"
          className="text-muted-foreground hover:text-foreground mb-1 flex cursor-pointer items-center gap-1 rounded px-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-40">
          <WandSparkles size={11} /> Format
        </button>
      </div>
      <JsonCodeField
        value={text}
        onChange={edit}
        height={height}
        className={error ? 'ring-destructive-border ring-1' : undefined}
        aria-label={typeof label === 'string' ? label : undefined}
      />
      <FieldFoot hint={hint} error={error} />
    </div>
  );
}
