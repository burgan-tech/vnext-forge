import * as React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';

export interface KeyValuePair {
  key: string;
  value: string;
}

interface KeyValueEditorProps extends Omit<React.ComponentProps<'div'>, 'onChange'> {
  addLabel?: string;
  keyPlaceholder?: string;
  onChange: (pairs: KeyValuePair[]) => void;
  pairs: KeyValuePair[];
  readOnly?: boolean;
  valuePlaceholder?: string;
}

function KeyValueEditor({
  addLabel = 'Add',
  className,
  keyPlaceholder = 'Key',
  onChange,
  pairs,
  readOnly = false,
  valuePlaceholder = 'Value',
  ...props
}: KeyValueEditorProps) {
  function updatePair(index: number, field: keyof KeyValuePair, value: string) {
    onChange(pairs.map((pair, currentIndex) => (currentIndex === index ? { ...pair, [field]: value } : pair)));
  }

  function addPair() {
    onChange([...pairs, { key: '', value: '' }]);
  }

  function removePair(index: number) {
    onChange(pairs.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div data-slot="key-value-editor" className={className} {...props}>
      <div className="space-y-2">
        {pairs.map((pair, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={pair.key}
              onChange={(event) => updatePair(index, 'key', event.target.value)}
              placeholder={keyPlaceholder}
              readOnly={readOnly}
            />
            <Input
              value={pair.value}
              onChange={(event) => updatePair(index, 'value', event.target.value)}
              placeholder={valuePlaceholder}
              readOnly={readOnly}
            />
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePair(index)}
                aria-label={`Remove row ${index + 1}`}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {!readOnly ? (
        <Button type="button" variant="ghost" size="sm" onClick={addPair} className="mt-2">
          <Plus className="size-4" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

export { KeyValueEditor };
