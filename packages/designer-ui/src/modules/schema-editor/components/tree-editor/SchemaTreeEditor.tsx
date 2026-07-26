import { Home } from 'lucide-react';

import { cn } from '../../../../lib/utils/cn';
import { ROOT_POINTER } from '../../model/jsonPointer';
import { useResolvedSelection, useSetSelection } from '../../hooks/useSchemaSelection';
import { DetailPanel } from './detail-panel/DetailPanel';
import { PropertyTree } from './property-tree/PropertyTree';
import { RootCompositionPanel } from './RootCompositionPanel';

/**
 * Two-pane root for the rewritten Schema tree editor. The left pane shows
 * a selectable "Schema root" row (the only way to re-select the schema
 * root once a property has been selected), a `RootCompositionPanel`
 * shortcut for editing root-level composition keywords, and the
 * `properties` tree of the schema root. The right pane shows tabbed
 * details for whichever node is currently selected (defaults to the
 * schema root).
 */
export function SchemaTreeEditor() {
  const selection = useResolvedSelection();

  return (
    <div className="grid min-h-[420px] gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
      <aside className="rounded-md border border-primary-border bg-primary-muted/30">
        <SchemaRootRow />
        <RootCompositionPanel />
        <PropertyTree parentPointer={ROOT_POINTER} />
      </aside>
      <section className="rounded-md border border-primary-border bg-primary-muted/30">
        <DetailPanel pointer={selection} />
      </section>
    </div>
  );
}

/**
 * Selectable row for the schema root. Property nodes in `PropertyTree` are
 * the only other selectable items in this aside, so without this row the
 * root's detail panel (and its root-scoped vNext `x-*` cards, e.g.
 * `x-context-target`) is unreachable once the user selects any property.
 * Styling mirrors the selected-state treatment used by `PropertyTreeNode`
 * (`bg-primary-muted/80`) for visual consistency.
 */
function SchemaRootRow() {
  const selection = useResolvedSelection();
  const setSelection = useSetSelection();
  const isSelected = selection === ROOT_POINTER;

  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={isSelected}
      aria-current={isSelected ? 'true' : undefined}
      aria-label="Schema root"
      onClick={() => setSelection(ROOT_POINTER)}
      className={cn(
        'flex w-full items-center gap-2 border-b border-primary-border px-2 py-1.5 text-left text-xs',
        'hover:bg-primary-hover/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-border-hover',
        isSelected ? 'bg-primary-muted/80 font-semibold text-primary-text' : 'text-primary-text/75',
      )}>
      <Home size={12} />
      Schema root
    </button>
  );
}
