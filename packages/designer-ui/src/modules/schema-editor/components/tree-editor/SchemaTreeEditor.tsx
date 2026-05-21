import { ROOT_POINTER } from '../../model/jsonPointer';
import { useResolvedSelection } from '../../hooks/useSchemaSelection';
import { DetailPanel } from './detail-panel/DetailPanel';
import { PropertyTree } from './property-tree/PropertyTree';

/**
 * Two-pane root for the rewritten Schema tree editor. Left pane shows the
 * `properties` tree of the schema root, right pane shows tabbed details
 * for whichever node is currently selected (defaults to the schema root).
 *
 * Phase 2 ships the property tree and the General tab; other tabs are
 * present but disabled placeholders.
 */
export function SchemaTreeEditor() {
  const selection = useResolvedSelection();

  return (
    <div className="grid min-h-[420px] gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
      <aside className="rounded-md border border-primary-border bg-primary-muted/30">
        <PropertyTree parentPointer={ROOT_POINTER} />
      </aside>
      <section className="rounded-md border border-primary-border bg-primary-muted/30">
        <DetailPanel pointer={selection} />
      </section>
    </div>
  );
}
