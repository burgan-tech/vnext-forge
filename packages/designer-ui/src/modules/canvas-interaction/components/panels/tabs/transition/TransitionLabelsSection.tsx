import type { Label } from '@vnext-forge/vnext-types';
import { EditableInput, IconPlus, IconTrash, Section } from '../PropertyPanelShared';

interface TransitionLabelsSectionProps {
  labels: Label[];
  onChange: (labels: Label[]) => void;
}

export function TransitionLabelsSection({ labels, onChange }: TransitionLabelsSectionProps) {
  const safeLabels = Array.isArray(labels) ? labels : [];

  const addLabel = () => {
    onChange([...safeLabels, { language: 'en', label: '' }]);
  };

  const updateLabel = (index: number, field: keyof Label, value: string) => {
    const next = safeLabels.map((l, i) =>
      i === index ? { ...l, [field]: value } : l,
    );
    onChange(next);
  };

  const removeLabel = (index: number) => {
    onChange(safeLabels.filter((_, i) => i !== index));
  };

  return (
    <Section title="Labels" count={safeLabels.length} defaultOpen={safeLabels.length > 0}>
      {safeLabels.length === 0 ? (
        <div className="text-muted-foreground py-2 text-center text-[11px]">
          No localized labels. Fallbacks may use the transition key.
        </div>
      ) : (
        <div className="space-y-2">
          {safeLabels.map((l, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <div className="w-14 shrink-0">
                <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                  Language
                </label>
                <EditableInput
                  value={l.language}
                  onChange={(v) => updateLabel(i, 'language', v)}
                  mono
                  placeholder="en"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                  Display name
                </label>
                <EditableInput
                  value={l.label}
                  onChange={(v) => updateLabel(i, 'label', v)}
                  placeholder="Display name"
                />
              </div>
              <button
                type="button"
                onClick={() => removeLabel(i)}
                className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 mt-4 transition-all"
                aria-label={`Remove label ${l.language}`}>
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={addLabel}
        className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors mt-1">
        <IconPlus />
        Add label
      </button>
    </Section>
  );
}
