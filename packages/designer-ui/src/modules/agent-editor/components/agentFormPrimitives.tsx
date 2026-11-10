import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

/**
 * Small controlled inputs shared by the AI Agent state tab and the
 * `sys-agents` component editor. Every field reports `undefined` for an
 * empty value so callers can drop the member instead of writing `""`.
 */

const INPUT =
  'w-full rounded-lg border border-border bg-muted-surface px-2.5 py-1.5 text-xs text-foreground focus:border-primary-border focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all';

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1">
      <label className="text-muted-foreground block text-[10px] font-semibold tracking-wide">{children}</label>
      {hint && <p className="text-subtle mt-0.5 text-[10px] leading-snug">{hint}</p>}
    </div>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono = false,
  error,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
  mono?: boolean;
  error?: string;
}) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="text"
        value={value ?? ''}
        placeholder={placeholder}
        aria-label={typeof label === 'string' ? label : undefined}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        className={`${INPUT} ${mono ? 'font-mono' : ''} ${error ? 'border-destructive-border' : ''}`}
      />
      {error && <p className="text-destructive-text mt-0.5 text-[10px]">{error}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 3,
  mono = false,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <textarea
        value={value ?? ''}
        rows={rows}
        placeholder={placeholder}
        aria-label={typeof label === 'string' ? label : undefined}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        className={`${INPUT} resize-y ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

/** Integer / number input; empty → `undefined`, invalid text is kept local until it parses. */
export function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  integer = true,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    setText(value === undefined ? '' : String(value));
  }, [value]);
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="number"
        value={text}
        min={min}
        max={max}
        step={step ?? (integer ? 1 : 0.1)}
        aria-label={typeof label === 'string' ? label : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (raw.trim() === '') {
            onChange(undefined);
            return;
          }
          const parsed = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className={`${INPUT} font-mono tabular-nums`}
      />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Native select; the empty-string option (when given) maps to `undefined`. */
export function SelectBox({
  label,
  hint,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  options: SelectOption[];
  /** When set, an extra first option that clears the value. */
  emptyLabel?: string;
}) {
  const known = value === undefined || value === '' || options.some((o) => o.value === value);
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select
        value={value ?? ''}
        aria-label={typeof label === 'string' ? label : undefined}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        className={`${INPUT} cursor-pointer`}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {!known && <option value={value}>{value} (not found)</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary mt-0.5"
      />
      <span>
        <span className="text-foreground block text-[11px] font-medium">{label}</span>
        {hint && <span className="text-subtle block text-[10px] leading-snug">{hint}</span>}
      </span>
    </label>
  );
}

/** Editable list of strings shown as chips, with optional suggestions. */
export function ChipsField({
  label,
  hint,
  values,
  onChange,
  suggestions = [],
  placeholder = 'Add…',
  pattern,
}: {
  label: ReactNode;
  hint?: ReactNode;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  pattern?: RegExp;
}) {
  const [draft, setDraft] = useState('');
  const invalid = draft !== '' && pattern !== undefined && !pattern.test(draft);
  const add = (value: string) => {
    const v = value.trim();
    if (!v || values.includes(v) || (pattern && !pattern.test(v))) return;
    onChange([...values, v]);
    setDraft('');
  };
  const open = suggestions.filter((s) => !values.includes(s));
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <span
            key={v}
            className="bg-muted text-foreground inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px]">
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-muted-foreground hover:text-destructive-text cursor-pointer">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          aria-label={typeof label === 'string' ? `Add to ${label}` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            }
          }}
          className={`${INPUT} font-mono ${invalid ? 'border-destructive-border' : ''}`}
        />
        <IconButton label="Add" onClick={() => add(draft)}>
          <Plus size={12} />
        </IconButton>
      </div>
      {open.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {open.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="border-border text-muted-foreground hover:text-foreground hover:border-primary-border cursor-pointer rounded-md border border-dashed px-1.5 py-0.5 font-mono text-[10px]">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-md border border-border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-muted-foreground hover:bg-destructive-surface hover:text-destructive-text'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}>
      {children}
    </button>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton label={label} onClick={onClick} danger>
      <Trash2 size={12} />
    </IconButton>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border text-muted-foreground hover:text-foreground hover:border-primary-border flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed py-1.5 text-[11px] font-medium transition-colors">
      <Plus size={12} /> {label}
    </button>
  );
}

/**
 * JSON object editor (textarea). Keeps the text locally while it does not
 * parse and only reports parsed objects, so typing never corrupts the
 * document.
 */
export function JsonObjectField({
  label,
  hint,
  value,
  onChange,
  rows = 6,
  requireObjectType = false,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: unknown;
  onChange: (next: Record<string, unknown> | undefined) => void;
  rows?: number;
  /** Require a JSON schema root of `"type": "object"`. */
  requireObjectType?: boolean;
}) {
  const serialized = value === undefined ? '' : JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setText(serialized);
    setError(null);
  }, [serialized]);
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <textarea
        value={text}
        rows={rows}
        spellCheck={false}
        aria-label={typeof label === 'string' ? label : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (raw.trim() === '') {
            setError(null);
            onChange(undefined);
            return;
          }
          try {
            const parsed: unknown = JSON.parse(raw);
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
              setError('Must be a JSON object.');
              return;
            }
            if (requireObjectType && (parsed as { type?: unknown }).type !== 'object') {
              setError('The schema root must be "type": "object".');
              return;
            }
            setError(null);
            onChange(parsed as Record<string, unknown>);
          } catch {
            setError('Invalid JSON.');
          }
        }}
        className={`${INPUT} resize-y font-mono text-[11px] ${error ? 'border-destructive-border' : ''}`}
      />
      {error && <p className="text-destructive-text mt-0.5 text-[10px]">{error}</p>}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground mb-2 text-[10px] leading-relaxed">{children}</p>;
}

export function IssueList({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="border-destructive-border bg-destructive-surface text-destructive-text space-y-0.5 rounded-lg border px-2.5 py-1.5 text-[10px] leading-snug">
      {issues.map((m, i) => (
        <li key={`${i}-${m}`}>{m}</li>
      ))}
    </ul>
  );
}
