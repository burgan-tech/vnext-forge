import { ChevronDown, ChevronUp, Copy, ExternalLink, Trash2 } from 'lucide-react';

import { Badge } from '../../../../../ui/Badge';
import { Button } from '../../../../../ui/Button';
import { type JsonPointer } from '../../../model/jsonPointer';
import { getNodeAt, summarizeNode } from '../../../model/schemaNode';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSetSelection } from '../../../hooks/useSchemaSelection';

interface SubschemaCardProps {
  /** Pointer of the subschema this card represents (e.g. `/allOf/0`). */
  pointer: JsonPointer;
  /** Human label for the slot, e.g. `allOf[0]` or `not`. */
  label: string;
  /** Whether the card should expose move-up / move-down affordances. */
  canMove?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onClone?: () => void;
  onRemove?: () => void;
}

/**
 * Compact summary row for a subschema reachable through a pointer. Clicking
 * "Open" pushes the selection so the right-hand detail panel switches to
 * editing that subschema. Used by `CompositionList` and `NotCompositionEditor`.
 */
export function SubschemaCard({
  pointer,
  label,
  canMove = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onClone,
  onRemove,
}: SubschemaCardProps) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const setSelection = useSetSelection();
  const node = getNodeAt(componentJson, pointer);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-mono text-xs font-semibold">{label}</p>
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
          onClick={() => setSelection(pointer)}>
          <ExternalLink size={11} />
          Open
        </Button>

        {canMove ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              disabled={!canMoveUp}
              aria-label={`Move ${label} up`}
              onClick={onMoveUp}>
              <ChevronUp size={12} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              disabled={!canMoveDown}
              aria-label={`Move ${label} down`}
              onClick={onMoveDown}>
              <ChevronDown size={12} />
            </Button>
          </>
        ) : null}

        {onClone ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            aria-label={`Clone ${label}`}
            onClick={onClone}>
            <Copy size={11} />
          </Button>
        ) : null}

        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 p-0 text-destructive-text"
            aria-label={`Remove ${label}`}
            onClick={onRemove}>
            <Trash2 size={11} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
