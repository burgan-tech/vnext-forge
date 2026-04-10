import { Plus, X } from 'lucide-react';

interface LabelEntry {
  language: string;
  label: string;
}

interface LabelEditorProps {
  labels: LabelEntry[];
  onChange: (labels: LabelEntry[]) => void;
  readOnly?: boolean;
}

export function LabelEditor({ labels, onChange, readOnly }: LabelEditorProps) {
  function updateLabel(index: number, field: 'language' | 'label', val: string) {
    const next = labels.map((l, i) => (i === index ? { ...l, [field]: val } : l));
    onChange(next);
  }

  function addLabel() {
    onChange([...labels, { language: 'en', label: '' }]);
  }

  function removeLabel(index: number) {
    onChange(labels.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-1">
      {labels.map((entry, i) => (
        <div key={i} className="flex gap-1 items-center">
          <input
            type="text"
            value={entry.language}
            onChange={(e) => updateLabel(i, 'language', e.target.value)}
            placeholder="lang"
            readOnly={readOnly}
            className="w-10 px-1.5 py-1 text-xs border border-border rounded bg-background text-center"
          />
          <input
            type="text"
            value={entry.label}
            onChange={(e) => updateLabel(i, 'label', e.target.value)}
            placeholder="Label text"
            readOnly={readOnly}
            className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
          />
          {!readOnly && (
            <button onClick={() => removeLabel(i)} className="text-muted-foreground hover:text-destructive shrink-0">
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button onClick={addLabel} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
          <Plus size={10} /> Add label
        </button>
      )}
    </div>
  );
}
