import { type JsonPointer } from '../../../../model/jsonPointer';
import { useSchemaNode } from '../../../../hooks/useSchemaNode';
import { VNEXT_CARD_REGISTRY } from '../../vnext/vnextCardRegistry';

interface VNextTabProps {
  pointer: JsonPointer;
}

/**
 * Renders every vNext (`x-*`) editor card for the selected node in a
 * single vertical stack. Each card manages its own enable/disable cycle
 * and value editor through the shared `VNextCardShell` so the tab feels
 * uniform across keywords.
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

  return (
    <div className="space-y-3">
      {VNEXT_CARD_REGISTRY.map(({ xKey, component: Card }) => (
        <Card key={xKey} pointer={pointer} />
      ))}
    </div>
  );
}
