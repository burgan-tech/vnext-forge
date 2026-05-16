import { useState, useEffect, useRef, useCallback } from 'react';
import { EditableInput, IconPlus, IconTrash, Section } from '../PropertyPanelShared';

interface TransitionAnnotationsSectionProps {
  annotations: Record<string, string> | undefined;
  onChange: (annotations: Record<string, string> | undefined) => void;
}

interface KVEntry { key: string; value: string }

function toEntries(annotations: Record<string, string> | undefined): KVEntry[] {
  if (!annotations) return [];
  return Object.entries(annotations).map(([key, value]) => ({ key, value }));
}

function toRecord(entries: KVEntry[]): Record<string, string> | undefined {
  const filtered = entries.filter((e) => e.key.trim() !== '');
  if (filtered.length === 0) return undefined;
  const record: Record<string, string> = {};
  for (const { key, value } of filtered) {
    record[key] = value;
  }
  return record;
}

export function TransitionAnnotationsSection({
  annotations,
  onChange,
}: TransitionAnnotationsSectionProps) {
  const [entries, setEntries] = useState<KVEntry[]>(() => toEntries(annotations));
  const externalRef = useRef(annotations);

  useEffect(() => {
    if (annotations !== externalRef.current) {
      externalRef.current = annotations;
      setEntries(toEntries(annotations));
    }
  }, [annotations]);

  const commit = useCallback(
    (next: KVEntry[]) => {
      const record = toRecord(next);
      externalRef.current = record;
      onChange(record);
    },
    [onChange],
  );

  const add = () => {
    setEntries((prev) => [...prev, { key: '', value: '' }]);
  };

  const update = (index: number, field: 'key' | 'value', v: string) => {
    setEntries((prev) => {
      const next = prev.map((e, i) => (i === index ? { ...e, [field]: v } : e));
      commit(next);
      return next;
    });
  };

  const remove = (index: number) => {
    setEntries((prev) => {
      const next = prev.filter((_, i) => i !== index);
      commit(next);
      return next;
    });
  };

  const count = entries.length;

  return (
    <Section title="Annotations" count={count} defaultOpen={count > 0}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Optional key-value metadata for client-side filtering and UI context.
        Use namespaced keys to avoid collisions (e.g. ui/visible-in, ui/priority).
      </p>
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                  Key
                </label>
                <EditableInput
                  value={entry.key}
                  onChange={(v) => update(i, 'key', v)}
                  mono
                  placeholder="e.g. ui/visible-in"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                  Value
                </label>
                <EditableInput
                  value={entry.value}
                  onChange={(v) => update(i, 'value', v)}
                  placeholder="Value"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 mt-4 transition-all"
                aria-label={`Remove annotation ${entry.key || i + 1}`}>
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={add}
        className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors mt-1">
        <IconPlus />
        Add annotation
      </button>
    </Section>
  );
}
