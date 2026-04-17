import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';

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
      <div className="rounded-xl border border-border bg-background p-2">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {flows.map((flow, i) => (
            <Badge
              key={`${flow}-${i}`}
              variant="success"
              className="gap-1 pr-1 text-[10px]"
            >
              <span>{flow}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFlow(i)}
                className="size-4 min-h-4 rounded-md text-current shadow-none hover:bg-destructive/12 hover:text-destructive"
                aria-label={`Remove ${flow} flow`}
              >
                <X size={10} />
              </Button>
            </Badge>
          ))}
        </div>
        <Input
          type="text"
          value={input}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={flows.length === 0 ? 'Type flow name...' : 'Add another flow'}
          variant="default"
          size="sm"
          className="min-w-[80px]"
          inputClassName="text-xs"
        />
      </div>
    </Field>
  );
}

