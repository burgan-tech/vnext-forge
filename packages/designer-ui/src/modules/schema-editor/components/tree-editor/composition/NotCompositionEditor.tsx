import { Plus } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { appendPointer, type JsonPointer } from '../../../model/jsonPointer';
import { toggleNot } from '../../../model/mutators';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { SubschemaCard } from './SubschemaCard';

interface NotCompositionEditorProps {
  pointer: JsonPointer;
}

/**
 * Editor for the single-valued `not` composition keyword. Toggling on
 * installs an empty subschema; toggling off deletes the keyword. The
 * present subschema can be opened in the detail panel via `SubschemaCard`.
 */
export function NotCompositionEditor({ pointer }: NotCompositionEditorProps) {
  const { node, mutate } = useSchemaNode(pointer);
  const isPresent = node?.not !== undefined;

  if (!isPresent) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2">
        <div>
          <p className="text-xs font-semibold">not</p>
          <p className="mt-0.5 text-[10px] text-primary-text/55">
            Instances must NOT validate against this schema.
          </p>
        </div>
        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={() => mutate(toggleNot(pointer))}>
          <Plus size={11} />
          Add
        </Button>
      </div>
    );
  }

  return (
    <SubschemaCard
      pointer={appendPointer(pointer, 'not')}
      label="not"
      onRemove={() => mutate(toggleNot(pointer))}
    />
  );
}
