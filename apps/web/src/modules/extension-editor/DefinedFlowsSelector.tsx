import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Field } from '@modules/save-component/components/Field';

interface DefinedFlowsSelectorProps {
  flows: string[];
  onChange: (flows: string[]) => void;
}

export function DefinedFlowsSelector({ flows, onChange }: DefinedFlowsSelectorProps) {
  const [input, setInput] = useState('');

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!flows.includes(input.trim())) {
        onChange([...flows, input.trim()]);
      }
      setInput('');
    }
    if (e.key === 'Backspace' && !input && flows.length > 0) {
      onChange(flows.slice(0, -1));
    }
  }

  function removeFlow(index: number) {
    onChange(flows.filter((_, i) => i !== index));
  }

  return (
    <Field label="Defined Flows" hint="Press Enter to add a flow name">
      <div className="flex flex-wrap gap-1 p-1.5 border border-border rounded bg-background min-h-[28px]">
        {flows.map((flow, i) => (
          <span
            key={`${flow}-${i}`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded"
          >
            {flow}
            <button onClick={() => removeFlow(i)} className="hover:text-destructive">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={flows.length === 0 ? 'Type flow name...' : ''}
          className="flex-1 min-w-[80px] text-xs bg-transparent outline-none"
        />
      </div>
    </Field>
  );
}
