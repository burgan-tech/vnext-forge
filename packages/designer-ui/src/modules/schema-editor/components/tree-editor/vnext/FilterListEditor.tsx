import { Plus, Trash2 } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { Checkbox } from '../../../../../ui/Checkbox';
import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';

export interface FilterEntry {
  param: string;
  value: string;
  required: boolean;
}

interface FilterListEditorProps {
  filters: FilterEntry[];
  onChange: (next: FilterEntry[]) => void;
}

/**
 * Lightweight list editor for the `filter` arrays inside `x-lov` and
 * `x-lookup`. Each entry binds a request parameter name to a JSONPath
 * (or literal) value sourced from the surrounding form context, with an
 * optional "required" flag that delays the request until the value is
 * available.
 */
export function FilterListEditor({ filters, onChange }: FilterListEditorProps) {
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
            className="grid gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2 sm:grid-cols-[1fr_2fr_auto_auto]">
            <Field label="Param">
              <Input
                type="text"
                value={entry.param}
                onChange={(event) => updateEntry(index, { param: event.target.value })}
                placeholder="cityCode"
                inputClassName="font-mono text-xs"
              />
            </Field>
            <Field label="Value">
              <Input
                type="text"
                value={entry.value}
                onChange={(event) => updateEntry(index, { value: event.target.value })}
                placeholder="$form.city"
                inputClassName="font-mono text-xs"
              />
            </Field>
            <div className="flex items-end gap-1.5 pb-1">
              <Checkbox
                id={`filter-required-${index}`}
                checked={entry.required}
                onCheckedChange={(value) => updateEntry(index, { required: value === true })}
              />
              <label htmlFor={`filter-required-${index}`} className="text-[10px]">
                required
              </label>
            </div>
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
          </div>
        ))
      )}

      <Button
        type="button"
        variant="success"
        size="sm"
        className="h-7 gap-1 text-[10px]"
        onClick={addEntry}>
        <Plus size={10} />
        Add filter
      </Button>
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
        value: typeof record.value === 'string' ? record.value : '',
        required: record.required === true,
      },
    ];
  });
}
