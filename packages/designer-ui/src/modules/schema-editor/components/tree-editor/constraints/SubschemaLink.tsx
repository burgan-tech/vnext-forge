import { ExternalLink, Plus, Trash2 } from 'lucide-react';

import { Badge } from '../../../../../ui/Badge';
import { Button } from '../../../../../ui/Button';
import { cn } from '../../../../../lib/utils/cn';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { getNodeAt, summarizeNode } from '../../../model/schemaNode';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSetSelection } from '../../../hooks/useSchemaSelection';

interface SubschemaLinkProps {
  /** Pointer of the subschema slot itself (e.g. `/properties/foo/items`). */
  targetPointer: JsonPointer;
  /** Friendly label shown next to the summary. */
  label: string;
  /** Optional helper hint shown when the slot is empty. */
  emptyHint?: string;
  /** Optional className applied to the outer container. */
  className?: string;
}

/**
 * Renders a single subschema-valued slot (e.g. `items`, `contains`,
 * `additionalProperties` when set to a schema). Clicking "Open" pushes
 * selection to `targetPointer` so the detail panel switches to editing
 * that subschema. The breadcrumb lets the user navigate back.
 */
export function SubschemaLink({ targetPointer, label, emptyHint, className }: SubschemaLinkProps) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const setSelection = useSetSelection();

  const node = getNodeAt(componentJson, targetPointer);
  const isPresent = node !== null;

  if (!isPresent) {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2',
          className,
        )}>
        <div className="min-w-0">
          <p className="text-xs font-semibold">{label}</p>
          {emptyHint ? (
            <p className="mt-0.5 text-[10px] text-primary-text/55">{emptyHint}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={() => {
            const parent = parentOfSlot(targetPointer);
            if (parent === null) {
              return;
            }
            updateComponent(setKeyword(parent.pointer, parent.keyword, {}));
            setSelection(targetPointer);
          }}>
          <Plus size={11} />
          Add
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2',
        className,
      )}>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-primary-text/65">
          {summarizeNode(node)}
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
          onClick={() => setSelection(targetPointer)}>
          <ExternalLink size={11} />
          Open
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[10px] text-destructive-text"
          aria-label={`Clear ${label}`}
          onClick={() => {
            const parent = parentOfSlot(targetPointer);
            if (parent === null) {
              return;
            }
            updateComponent(setKeyword(parent.pointer, parent.keyword, undefined));
          }}>
          <Trash2 size={11} />
        </Button>
      </div>
    </div>
  );
}

/**
 * Split a slot pointer (`/foo/items`) into its container pointer (`/foo`)
 * and the keyword (`items`). Used by add/clear handlers.
 */
function parentOfSlot(pointer: JsonPointer): { pointer: JsonPointer; keyword: string } | null {
  if (pointer === '') {
    return null;
  }

  const lastSlash = pointer.lastIndexOf('/');
  const keyword = pointer.slice(lastSlash + 1);
  const container: JsonPointer = lastSlash <= 0 ? '' : pointer.slice(0, lastSlash);
  return { pointer: container, keyword };
}
