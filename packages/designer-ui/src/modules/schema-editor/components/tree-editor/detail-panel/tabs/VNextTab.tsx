import { useFormReadOnly } from '../../../../../../ui/FormReadOnlyContext';
import { ROOT_POINTER, type JsonPointer } from '../../../../model/jsonPointer';
import { setKeyword } from '../../../../model/mutators';
import { roleAllowsKeyword, roleKeywordViolation } from '../../../../model/schemaRoles';
import { useSchemaNode } from '../../../../hooks/useSchemaNode';
import { useSchemaRole } from '../../../../hooks/useSchemaRole';
import { useSchemaEditorStore } from '../../../../useSchemaEditorStore';
import { VNEXT_CARD_REGISTRY } from '../../vnext/vnextCardRegistry';

/** Old annotations 0.0.56 refuses whatever the role (see `schemaRoles`). */
const REMOVED_ANNOTATIONS = new Set(['x-persistance', 'x-encrypt']);

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
 *
 * When the schema has a role (vnext-schema ≥ 0.0.56), cards for annotations
 * the role's vocabulary refuses are hidden, and annotations already on the
 * node that the role refuses are flagged with a remove action. Untyped and
 * legacy-typed schemas keep every card (no role gate to mirror).
 */
export function VNextTab({ pointer }: VNextTabProps) {
  const readOnly = useFormReadOnly();
  const { node } = useSchemaNode(pointer);
  const role = useSchemaRole();
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);

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
  const visibleCards = role
    ? scopedCards.filter(({ xKey }) => roleAllowsKeyword(role, xKey) || node[xKey] !== undefined)
    : scopedCards;
  const hiddenKeys = scopedCards.filter((card) => !visibleCards.includes(card)).map(({ xKey }) => xKey);
  // Role-gated annotations are judged only when the schema has a role;
  // removed annotations (x-persistance, x-encrypt) are flagged regardless.
  const violations = Object.entries(node)
    .filter(([key]) => key.startsWith('x-') && (role !== undefined || REMOVED_ANNOTATIONS.has(key)))
    .map(([key, value]) => ({ key, message: roleKeywordViolation(role, key, value) }))
    .filter((v): v is { key: string; message: string } => v.message !== null);

  // Read-only hosts render EVERY scoped card — set ones expanded with their
  // content, unset ones collapsed with a "Not set" badge — so reviewers can
  // see at a glance which annotations were entered and which were not.
  return (
    <div className="space-y-3">
      {violations.map(({ key, message }) => (
        <div
          key={`violation:${key}`}
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <span className="min-w-0 flex-1">{message}</span>
          {readOnly ? null : (
            <button
              type="button"
              onClick={() => updateComponent(setKeyword(pointer, key, undefined))}
              className="cursor-pointer font-semibold underline">
              Remove {key}
            </button>
          )}
        </div>
      ))}
      {visibleCards.map(({ xKey, component: Card }) => (
        // Read-only only: keying by pointer remounts each card when the
        // selection changes so per-card local state (e.g. x-context-target
        // rows) is re-seeded from the newly selected node. Editor shells keep
        // the stable key so remount behavior there is untouched.
        <Card key={readOnly ? `${xKey}:${pointer}` : xKey} pointer={pointer} />
      ))}
      {hiddenKeys.length > 0 ? (
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          Not available on a {role} schema: <span className="font-mono">{hiddenKeys.join(', ')}</span>.
        </p>
      ) : null}
    </div>
  );
}
