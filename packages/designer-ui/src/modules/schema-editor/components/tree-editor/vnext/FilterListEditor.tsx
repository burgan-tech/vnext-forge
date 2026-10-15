import { Plus, Trash2 } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { Checkbox } from '../../../../../ui/Checkbox';
import { Field } from '../../../../../ui/Field';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { Input } from '../../../../../ui/Input';
import { CommaListInput, parseCommaList } from './CommaListInput';

export interface FilterEntry {
  /** Request parameter; may carry a list-query operator (`status:in`). */
  param: string;
  /** A literal or `$form.` / `$instance.` / `$param.` reference; a literal list reaches `in` / `nin`. */
  value: string | unknown[];
  required: boolean;
}

/** Text shown for a list literal: comma-separated items. */
function listToText(value: unknown[]): string {
  return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(', ');
}

/** Comma-separated text → list literal (blank items dropped). */
export const textToList = parseCommaList;

interface FilterListEditorProps {
  filters: FilterEntry[];
  onChange: (next: FilterEntry[]) => void;
}

/**
 * Lightweight list editor for the `filter` arrays inside `x-lov` and
 * `x-lookup`. Each entry binds a request parameter name (optionally with an
 * operator, `status:in`) to a literal, a literal list, or a `$form.` /
 * `$instance.` / `$param.` reference, with an optional "required" flag that
 * delays the request until the value is available.
 */
export function FilterListEditor({ filters, onChange }: FilterListEditorProps) {
  const readOnly = useFormReadOnly();

  function updateEntry(index: number, patch: Partial<FilterEntry>) {
    onChange(filters.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function removeEntry(index: number) {
    onChange(filters.filter((_, i) => i !== index));
  }

  function addEntry() {
    onChange([...filters, { param: '', value: '', required: false }]);
  }

  return (
    <div className="space-y-2">
      {filters.length === 0 ? (
        <p className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2 text-[10px] text-primary-text/55">
          No filter parameters yet.
        </p>
      ) : (
        filters.map((entry, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2 sm:grid-cols-[1fr_2fr_auto_auto_auto]">
            <Field label="Param" hint="Add :in, :gte… for an operator.">
              <Input
                type="text"
                value={entry.param}
                onChange={(event) => updateEntry(index, { param: event.target.value })}
                placeholder="cityCode"
                inputClassName="font-mono text-xs"
              />
            </Field>
            <Field label={Array.isArray(entry.value) ? 'Values (comma-separated)' : 'Value'}>
              {Array.isArray(entry.value) ? (
                <CommaListInput
                  value={entry.value}
                  onCommit={(value) => updateEntry(index, { value })}
                  placeholder="active, pending"
                />
              ) : (
                <Input
                  type="text"
                  value={entry.value}
                  onChange={(event) => updateEntry(index, { value: event.target.value })}
                  placeholder="$form.city"
                  inputClassName="font-mono text-xs"
                />
              )}
            </Field>
            <div className="flex items-end gap-1.5 pb-1">
              <Checkbox
                id={`filter-list-${index}`}
                checked={Array.isArray(entry.value)}
                aria-readonly={readOnly || undefined}
                tabIndex={readOnly ? -1 : undefined}
                className={readOnly ? 'pointer-events-none' : undefined}
                onCheckedChange={(checked) => {
                  if (readOnly) return;
                  updateEntry(index, {
                    value:
                      checked === true
                        ? textToList(Array.isArray(entry.value) ? listToText(entry.value) : entry.value)
                        : Array.isArray(entry.value)
                          ? listToText(entry.value)
                          : entry.value,
                  });
                }}
              />
              <label
                htmlFor={`filter-list-${index}`}
                className={readOnly ? 'pointer-events-none text-[10px]' : 'text-[10px]'}
                title="A literal list, for the in / nin operators">
                list
              </label>
            </div>
            <div className="flex items-end gap-1.5 pb-1">
              {/* Read-only: keep the designer look (not disabled/gray) but
                  make the control fully non-interactive. */}
              <Checkbox
                id={`filter-required-${index}`}
                checked={entry.required}
                aria-readonly={readOnly || undefined}
                tabIndex={readOnly ? -1 : undefined}
                className={readOnly ? 'pointer-events-none' : undefined}
                onCheckedChange={(value) => {
                  if (readOnly) {
                    return;
                  }
                  updateEntry(index, { required: value === true });
                }}
              />
              <label
                htmlFor={`filter-required-${index}`}
                className={readOnly ? 'pointer-events-none text-[10px]' : 'text-[10px]'}>
                required
              </label>
            </div>
            {!readOnly && (
              <div className="flex items-end pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-destructive-text"
                  aria-label={`Remove filter ${index + 1}`}
                  onClick={() => removeEntry(index)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      {!readOnly && (
        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={addEntry}>
          <Plus size={10} />
          Add filter
        </Button>
      )}
    </div>
  );
}

export function normalizeFilterEntries(value: unknown): FilterEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): FilterEntry[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    const record = entry as Record<string, unknown>;

    return [
      {
        param: typeof record.param === 'string' ? record.param : '',
        value:
          typeof record.value === 'string' ? record.value : Array.isArray(record.value) ? record.value : '',
        required: record.required === true,
      },
    ];
  });
}
