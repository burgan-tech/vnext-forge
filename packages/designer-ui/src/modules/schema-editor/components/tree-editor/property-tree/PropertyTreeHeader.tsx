import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/Dialog';
import { Input } from '../../../../../ui/Input';
import { appendPointer, type JsonPointer } from '../../../model/jsonPointer';
import { addProp } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSetSelection } from '../../../hooks/useSchemaSelection';

interface PropertyTreeHeaderProps {
  parentPointer: JsonPointer;
  existingKeys: readonly string[];
}

/**
 * Toolbar for the property tree: "Add property" button and dialog that
 * collects a new property name. After adding, the new property is
 * auto-selected so the user can configure it immediately.
 */
export function PropertyTreeHeader({ parentPointer, existingKeys }: PropertyTreeHeaderProps) {
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const setSelection = useSetSelection();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const trimmed = name.trim();
  const isEmpty = trimmed.length === 0;
  const isDuplicate = existingKeys.includes(trimmed);
  const isInvalid = isEmpty || isDuplicate;

  function confirm() {
    if (isInvalid) {
      return;
    }

    updateComponent(addProp(parentPointer, trimmed));
    setSelection(appendPointer(parentPointer, 'properties', trimmed));
    setName('');
    setOpen(false);
  }

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <span className="text-xs font-semibold text-primary-text/75">Properties</span>
      <Button
        type="button"
        variant="success"
        size="sm"
        className="h-6 gap-1 text-[10px]"
        onClick={() => setOpen(true)}>
        <Plus size={10} />
        Add property
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setName('');
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add property</DialogTitle>
          </DialogHeader>
          <DialogDescription>Enter a name for the new schema property.</DialogDescription>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                confirm();
              }
            }}
            placeholder="property_name"
            inputClassName="font-mono text-sm"
            error={isDuplicate ? `A property named "${trimmed}" already exists.` : undefined}
            autoFocus
          />
          <DialogFooter>
            <DialogCancelButton variant="destructive">Cancel</DialogCancelButton>
            <Button type="button" variant="success" disabled={isInvalid} onClick={confirm}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
