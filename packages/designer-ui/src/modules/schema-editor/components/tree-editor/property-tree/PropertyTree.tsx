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
import { getNodeAt, getPropertyKeys } from '../../../model/schemaNode';
import { useSetSelection } from '../../../hooks/useSchemaSelection';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { PropertyTreeHeader } from './PropertyTreeHeader';
import { PropertyTreeNode } from './PropertyTreeNode';

interface PropertyTreeProps {
  parentPointer: JsonPointer;
  depth?: number;
}

/**
 * Renders the `properties` map of the node addressed by `parentPointer`.
 * Recursively used by `PropertyTreeNode` to render nested object schemas.
 * The header (with the "Add property" affordance) is only shown at the
 * root level (`depth === 0`); nested levels get a quieter inline button.
 */
export function PropertyTree({ parentPointer, depth = 0 }: PropertyTreeProps) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const node = getNodeAt(componentJson, parentPointer);
  const keys = getPropertyKeys(node);

  return (
    <div className="space-y-0.5">
      {depth === 0 ? <PropertyTreeHeader parentPointer={parentPointer} existingKeys={keys} /> : null}

      {keys.length === 0 && depth === 0 ? (
        <div className="px-2 py-4 text-center text-[11px] text-primary-text/55">
          No properties yet. Click <span className="font-semibold">Add property</span> to begin.
        </div>
      ) : null}

      {keys.map((key) => (
        <PropertyTreeNode
          key={key}
          parentPointer={parentPointer}
          propertyKey={key}
          depth={depth}
        />
      ))}

      {depth > 0 ? (
        <NestedAddButton parentPointer={parentPointer} existingKeys={keys} depth={depth} />
      ) : null}
    </div>
  );
}

interface NestedAddButtonProps {
  parentPointer: JsonPointer;
  existingKeys: readonly string[];
  depth: number;
}

function NestedAddButton({ parentPointer, existingKeys, depth }: NestedAddButtonProps) {
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
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-5 gap-1 text-[9px] text-primary-text/55"
        style={{ marginLeft: `${depth * 12 + 6}px` }}
        onClick={() => setOpen(true)}>
        <Plus size={9} />
        Add nested
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
            <DialogTitle>Add nested property</DialogTitle>
          </DialogHeader>
          <DialogDescription>Adds a property under the selected object.</DialogDescription>
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
    </>
  );
}
