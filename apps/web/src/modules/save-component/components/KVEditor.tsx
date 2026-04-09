import { Plus, X } from 'lucide-react';

interface KVPair {
  key: string;
  value: string;
}

interface KVEditorProps {
  pairs: KVPair[];
  onChange: (pairs: KVPair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  readOnly?: boolean;
}

export function KVEditor({ pairs, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', readOnly }: KVEditorProps) {
  function updatePair(index: number, field: 'key' | 'value', val: string) {
    const next = pairs.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    onChange(next);
  }

  function addPair() {
    onChange([...pairs, { key: '', value: '' }]);
  }

  function removePair(index: number) {
    onChange(pairs.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-1">
      {pairs.map((pair, i) => (
        <div key={i} className="flex gap-1 items-center">
          <input
            type="text"
            value={pair.key}
            onChange={(e) => updatePair(i, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            readOnly={readOnly}
            className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
          />
          <input
            type="text"
            value={pair.value}
            onChange={(e) => updatePair(i, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            readOnly={readOnly}
            className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
          />
          {!readOnly && (
            <button onClick={() => removePair(i)} className="text-muted-foreground hover:text-destructive shrink-0">
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          onClick={addPair}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <Plus size={10} /> Add
        </button>
      )}
    </div>
  );
}
