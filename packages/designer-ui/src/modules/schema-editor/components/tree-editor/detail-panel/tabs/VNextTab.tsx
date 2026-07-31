import { useFormReadOnly } from '../../../../../../ui/FormReadOnlyContext';
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
  const readOnly = useFormReadOnly();
  const { node } = useSchemaNode(pointer);

  if (!node) {
    return (
      <div className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/40 p-4 text-center text-[11px] text-primary-text/65">
        Select a property in the tree to edit its vNext extensions.
      </div>
    );
  }

  const isRoot = pointer === ROOT_POINTER;
  const scopedCards = VNEXT_CARD_REGISTRY.filter(({ scope }) =>
    scope === 'any' ? true : isRoot ? scope === 'root' : scope === 'property',
  );

  // Read-only hosts render EVERY scoped card — set ones expanded with their
  // content, unset ones collapsed with a "Not set" badge — so reviewers can
  // see at a glance which annotations were entered and which were not.
  return (
    <div className="space-y-3">
      {scopedCards.map(({ xKey, component: Card }) => (
        // Read-only only: keying by pointer remounts each card when the
        // selection changes so per-card local state (e.g. x-context-target
        // rows) is re-seeded from the newly selected node. Editor shells keep
        // the stable key so remount behavior there is untouched.
        <Card key={readOnly ? `${xKey}:${pointer}` : xKey} pointer={pointer} />
      ))}
    </div>
  );
}
