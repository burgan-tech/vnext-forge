import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

import { Badge } from '../../../../../ui/Badge';
import { Button } from '../../../../../ui/Button';
import { cn } from '../../../../../lib/utils/cn';
import { appendPointer, type JsonPointer } from '../../../model/jsonPointer';
import { countCompositionItems } from '../../../model/compositionKeywords';
import { removeProp } from '../../../model/mutators';
import { getNodeAt, getNodeType, getPropertyKeys, isObjectNode, isRequiredKey } from '../../../model/schemaNode';
import { useResolvedSelection, useSetSelection } from '../../../hooks/useSchemaSelection';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { PropertyTree } from './PropertyTree';

interface PropertyTreeNodeProps {
  parentPointer: JsonPointer;
  propertyKey: string;
  depth: number;
}

/**
 * One row in the property tree: chevron (if expandable), name, type badge,
 * composition badges, required indicator, delete. Clicking the row selects
 * the node so the right-hand detail panel switches to it.
 */
export function PropertyTreeNode({ parentPointer, propertyKey, depth }: PropertyTreeNodeProps) {
  const pointer = appendPointer(parentPointer, 'properties', propertyKey);
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const selection = useResolvedSelection();
  const setSelection = useSetSelection();

  const node = getNodeAt(componentJson, pointer);
  const parentNode = getNodeAt(componentJson, parentPointer);

  const expandable = isObjectNode(node) && getPropertyKeys(node).length > 0;
  const [expanded, setExpanded] = useState(true);

  const isSelected = selection === pointer;
  const isRequired = isRequiredKey(parentNode, propertyKey);
  const type = getNodeType(node);

  const allOfCount = countCompositionItems(node ?? undefined, 'allOf');
  const anyOfCount = countCompositionItems(node ?? undefined, 'anyOf');
  const oneOfCount = countCompositionItems(node ?? undefined, 'oneOf');
  const hasNot = !!node?.not;

  function selectThis() {
    setSelection(pointer);
  }

  function onDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    updateComponent(removeProp(parentPointer, propertyKey));

    if (selection === pointer) {
      setSelection(parentPointer);
    }
  }

  return (
    <div>
      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={expandable ? expanded : undefined}
        onClick={selectThis}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectThis();
          }
        }}
        className={cn(
          'group flex items-center gap-1 rounded-md px-1.5 py-1 text-xs cursor-pointer',
          'hover:bg-primary-hover/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-border-hover',
          isSelected && 'bg-primary-muted/80',
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}>
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

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Delete ${propertyKey}`}
          onClick={onDelete}>
          <Trash2 size={12} />
        </Button>
      </div>

      {expandable && expanded ? <PropertyTree parentPointer={pointer} depth={depth + 1} /> : null}
    </div>
  );
}
