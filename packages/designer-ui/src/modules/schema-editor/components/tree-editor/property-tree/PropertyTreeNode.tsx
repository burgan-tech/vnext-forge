import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ChevronDown as ChevronDownSolid, GripVertical, Trash2 } from 'lucide-react';

import { Badge } from '../../../../../ui/Badge';
import { Button } from '../../../../../ui/Button';
import { cn } from '../../../../../lib/utils/cn';
import { appendPointer, type JsonPointer } from '../../../model/jsonPointer';
import { countCompositionItems } from '../../../model/compositionKeywords';
import { moveProp, removeProp } from '../../../model/mutators';
import { getNodeAt, getNodeType, getPropertyKeys, isObjectNode, isRequiredKey } from '../../../model/schemaNode';
import { useResolvedSelection, useSetSelection } from '../../../hooks/useSchemaSelection';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { PropertyTree } from './PropertyTree';
import { usePropertyTreeDnd } from './usePropertyTreeDnd';

interface PropertyTreeNodeProps {
  parentPointer: JsonPointer;
  propertyKey: string;
  depth: number;
}

/**
 * One row in the property tree: chevron (if expandable), name, type badge,
 * composition badges, required indicator, delete. Clicking the row selects
 * the node so the right-hand detail panel switches to it. Supports HTML5
 * drag-and-drop for sibling reorder plus a `Alt+ArrowUp`/`Alt+ArrowDown`
 * keyboard fallback.
 */
export function PropertyTreeNode({ parentPointer, propertyKey, depth }: PropertyTreeNodeProps) {
  const pointer = appendPointer(parentPointer, 'properties', propertyKey);
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const selection = useResolvedSelection();
  const setSelection = useSetSelection();
  const { dragProps, dropProps, isDropTarget } = usePropertyTreeDnd({
    parentPointer,
    propertyKey,
  });

  const node = getNodeAt(componentJson, pointer);
  const parentNode = getNodeAt(componentJson, parentPointer);

  const expandable = isObjectNode(node) && getPropertyKeys(node).length > 0;
  const [expanded, setExpanded] = useState(true);

  const isSelected = selection === pointer;
  const isRequired = isRequiredKey(parentNode, propertyKey);
  const type = getNodeType(node);
  const siblings = getPropertyKeys(parentNode);
  const indexInParent = siblings.indexOf(propertyKey);
  const canMoveUp = indexInParent > 0;
  const canMoveDown = indexInParent >= 0 && indexInParent < siblings.length - 1;

  const allOfCount = countCompositionItems(node ?? undefined, 'allOf');
  const anyOfCount = countCompositionItems(node ?? undefined, 'anyOf');
  const oneOfCount = countCompositionItems(node ?? undefined, 'oneOf');
  const hasNot = !!node?.not;

  function selectThis() {
    setSelection(pointer);
  }

  function moveBy(delta: number) {
    if ((delta < 0 && !canMoveUp) || (delta > 0 && !canMoveDown)) {
      return;
    }

    updateComponent(moveProp(parentPointer, propertyKey, delta));
  }

  function onDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    updateComponent(removeProp(parentPointer, propertyKey));

    if (selection === pointer) {
      setSelection(parentPointer);
    }
  }

  function focusSibling(direction: 1 | -1) {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>('[role="tree"] [role="treeitem"]'),
    );
    const current = items.findIndex((el) => el === document.activeElement);

    if (current < 0) {
      return;
    }

    const next = items[current + direction];
    next?.focus();
  }

  return (
    <div role="none">
      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={expandable ? expanded : undefined}
        aria-level={depth + 1}
        aria-label={`${propertyKey}${type ? ` (${type})` : ''}${isRequired ? ' — required' : ''}`}
        onClick={selectThis}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectThis();
            return;
          }

          if (event.altKey && event.key === 'ArrowUp') {
            event.preventDefault();
            moveBy(-1);
            return;
          }

          if (event.altKey && event.key === 'ArrowDown') {
            event.preventDefault();
            moveBy(1);
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusSibling(-1);
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusSibling(1);
            return;
          }

          if (expandable && event.key === 'ArrowRight' && !expanded) {
            event.preventDefault();
            setExpanded(true);
            return;
          }

          if (expandable && event.key === 'ArrowLeft' && expanded) {
            event.preventDefault();
            setExpanded(false);
          }
        }}
        {...dropProps}
        className={cn(
          'group flex items-center gap-1 rounded-md px-1.5 py-1 text-xs cursor-pointer',
          'hover:bg-primary-hover/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-border-hover',
          isSelected && 'bg-primary-muted/80',
          isDropTarget && 'ring-2 ring-info-border',
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}>
        <span
          {...dragProps}
          className="grid size-4 place-items-center text-primary-text/40 hover:text-primary-text/70 cursor-grab active:cursor-grabbing"
          aria-label={`Drag ${propertyKey}`}
          onClick={(event) => event.stopPropagation()}>
          <GripVertical size={11} />
        </span>

        {expandable ? (
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
            className="grid size-4 place-items-center rounded text-primary-text/60 hover:text-primary-text">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span aria-hidden className="inline-block size-4" />
        )}

        <span className="min-w-0 flex-1 truncate font-mono">{propertyKey}</span>

        {type ? (
          <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
            {type}
          </Badge>
        ) : null}

        {allOfCount > 0 ? (
          <Badge variant="info" className="px-1.5 py-0 text-[9px]">
            allOf:{allOfCount}
          </Badge>
        ) : null}
        {anyOfCount > 0 ? (
          <Badge variant="info" className="px-1.5 py-0 text-[9px]">
            anyOf:{anyOfCount}
          </Badge>
        ) : null}
        {oneOfCount > 0 ? (
          <Badge variant="info" className="px-1.5 py-0 text-[9px]">
            oneOf:{oneOfCount}
          </Badge>
        ) : null}
        {hasNot ? (
          <Badge variant="info" className="px-1.5 py-0 text-[9px]">
            not
          </Badge>
        ) : null}

        {isRequired ? (
          <Badge variant="warning" className="px-1.5 py-0 text-[9px]" title="Required">
            *
          </Badge>
        ) : null}

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0"
            disabled={!canMoveUp}
            aria-label={`Move ${propertyKey} up`}
            onClick={(event) => {
              event.stopPropagation();
              moveBy(-1);
            }}>
            <ChevronUp size={12} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0"
            disabled={!canMoveDown}
            aria-label={`Move ${propertyKey} down`}
            onClick={(event) => {
              event.stopPropagation();
              moveBy(1);
            }}>
            <ChevronDownSolid size={12} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0"
            aria-label={`Delete ${propertyKey}`}
            onClick={onDelete}>
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      {expandable && expanded ? <PropertyTree parentPointer={pointer} depth={depth + 1} /> : null}
    </div>
  );
}
