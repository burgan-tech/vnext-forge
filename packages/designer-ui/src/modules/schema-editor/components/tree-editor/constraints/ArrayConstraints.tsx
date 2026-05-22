import { ExternalLink, Plus, Trash2 } from 'lucide-react';

import { Badge } from '../../../../../ui/Badge';
import { Button } from '../../../../../ui/Button';
import { Checkbox } from '../../../../../ui/Checkbox';
import { Field } from '../../../../../ui/Field';
import { Label } from '../../../../../ui/Label';
import { appendPointer, type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { getNodeAt, summarizeNode } from '../../../model/schemaNode';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useSetSelection } from '../../../hooks/useSchemaSelection';
import { NumberFieldInput } from './NumberFieldInput';
import { SubschemaLink } from './SubschemaLink';

interface ArrayConstraintsProps {
  pointer: JsonPointer;
}

/**
 * Constraint editors that apply to `type: "array"`:
 * minItems, maxItems, uniqueItems, items (subschema), contains (subschema),
 * prefixItems (array of subschemas — addressed positionally).
 */
export function ArrayConstraints({ pointer }: ArrayConstraintsProps) {
  const { node, mutate } = useSchemaNode(pointer);
  const uniqueItems = node?.uniqueItems === true;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberFieldInput
          pointer={pointer}
          keyword="minItems"
          label="minItems"
          hint="Minimum number of entries in the array."
          min={0}
          integerOnly
        />
        <NumberFieldInput
          pointer={pointer}
          keyword="maxItems"
          label="maxItems"
          hint="Maximum number of entries in the array."
          min={0}
          integerOnly
        />
      </div>

      <div className="flex items-center gap-2 rounded-md border border-primary-border/60 px-3 py-2">
        <Checkbox
          id={`unique-items-${pointer || 'root'}`}
          checked={uniqueItems}
          onCheckedChange={(value) => {
            mutate(setKeyword(pointer, 'uniqueItems', value === true ? true : undefined));
          }}
        />
        <Label htmlFor={`unique-items-${pointer || 'root'}`} className="cursor-pointer text-xs">
          uniqueItems — all entries must be distinct
        </Label>
      </div>

      <SubschemaLink
        targetPointer={appendPointer(pointer, 'items')}
        label="items"
        emptyHint="Schema applied to every element after any prefixItems entries."
      />

      <SubschemaLink
        targetPointer={appendPointer(pointer, 'contains')}
        label="contains"
        emptyHint="At least one element must match this schema."
      />

      <PrefixItemsList pointer={pointer} />
    </div>
  );
}

interface PrefixItemsListProps {
  pointer: JsonPointer;
}

function PrefixItemsList({ pointer }: PrefixItemsListProps) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const setSelection = useSetSelection();

  const node = getNodeAt(componentJson, pointer);
  const stored = node?.prefixItems;
  const items: unknown[] = Array.isArray(stored) ? stored : [];

  function setItems(next: unknown[]) {
    updateComponent(setKeyword(pointer, 'prefixItems', next.length === 0 ? undefined : next));
  }

  function addItem() {
    setItems([...items, {}]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  return (
    <Field
      label="prefixItems"
      hint="Schemas applied to elements at fixed positions, in order.">
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2 text-[10px] text-primary-text/55">
            No positional schemas yet. Add one to constrain the element at a fixed index.
          </p>
        ) : (
          items.map((item, index) => {
            const itemPointer = appendPointer(pointer, 'prefixItems', index);
            const itemNode = getNodeAt(componentJson, itemPointer);

            return (
              <div
                key={index}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">prefixItems[{index}]</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-primary-text/65">
                    {summarizeNode(itemNode)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
                    subschema
                  </Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 gap-1 text-[10px]"
                    onClick={() => setSelection(itemPointer)}>
                    <ExternalLink size={11} />
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-destructive-text"
                    aria-label={`Remove prefixItems[${index}]`}
                    onClick={() => removeItem(index)}>
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            );
          })
        )}

        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={addItem}>
          <Plus size={10} />
          Add positional schema
        </Button>
      </div>
    </Field>
  );
}
