import { ROOT_POINTER, type JsonPointer } from '../../../../model/jsonPointer';
import { useSchemaNode } from '../../../../hooks/useSchemaNode';
import { VNEXT_CARD_REGISTRY } from '../../vnext/vnextCardRegistry';

interface VNextTabProps {
  pointer: JsonPointer;
}

/**
 * Renders every vNext (`x-*`) editor card whose `scope` matches the selected
 * node's pointer, in a single vertical stack. At the schema root, `'root'`
 * and `'any'`-scoped cards render; at a property pointer, `'property'` and
 * `'any'`-scoped cards render. Every pre-existing card is registered with
 * `scope: 'any'`, so this filter is a pure addition — it does not hide any
 * card that used to render at the root or at a property. Each card manages
 * its own enable/disable cycle and value editor through the shared
 * `VNextCardShell` so the tab feels uniform across keywords.
 */
export function VNextTab({ pointer }: VNextTabProps) {
  const { node } = useSchemaNode(pointer);

  if (!node) {
    return (
      <div className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/40 p-4 text-center text-[11px] text-primary-text/65">
        Select a property in the tree to edit its vNext extensions.
      </div>
    );
  }

  const isRoot = pointer === ROOT_POINTER;
  const cards = VNEXT_CARD_REGISTRY.filter(({ scope }) =>
    scope === 'any' ? true : isRoot ? scope === 'root' : scope === 'property',
  );

  return (
    <div className="space-y-3">
      {cards.map(({ xKey, component: Card }) => (
        <Card key={xKey} pointer={pointer} />
      ))}
    </div>
  );
}
