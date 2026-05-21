import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '../../../../ui/Badge';
import { cn } from '../../../../lib/utils/cn';
import {
  ARRAY_COMPOSITION_KEYWORDS,
  countCompositionItems,
} from '../../model/compositionKeywords';
import { ROOT_POINTER } from '../../model/jsonPointer';
import { useSchemaNode } from '../../hooks/useSchemaNode';
import { CompositionList } from './composition/CompositionList';
import { NotCompositionEditor } from './composition/NotCompositionEditor';

/**
 * Shortcut panel for editing root-level composition keywords without first
 * having to navigate to the root in the property tree. Renders the same
 * `CompositionList` and `NotCompositionEditor` components used in the
 * detail panel's Composition tab; selections still push the right-hand
 * pane via `SubschemaCard` → "Open".
 *
 * Collapsed by default. The header surfaces a count badge per keyword so
 * users can see at a glance whether the schema already has root-level
 * composition rules.
 */
export function RootCompositionPanel() {
  const { node } = useSchemaNode(ROOT_POINTER);
  const [expanded, setExpanded] = useState(false);

  const counts = {
    allOf: countCompositionItems(node ?? undefined, 'allOf'),
    anyOf: countCompositionItems(node ?? undefined, 'anyOf'),
    oneOf: countCompositionItems(node ?? undefined, 'oneOf'),
    not: countCompositionItems(node ?? undefined, 'not'),
  };

  const totalActive = counts.allOf + counts.anyOf + counts.oneOf + counts.not;

  return (
    <section
      className="border-b border-primary-border"
      aria-label="Root-level schema composition">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          'flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs',
          'hover:bg-primary-hover/30',
        )}
        aria-expanded={expanded}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-semibold text-primary-text/75">Root composition</span>

        {totalActive === 0 ? (
          <span className="ml-auto text-[10px] text-primary-text/45">none</span>
        ) : (
          <span className="ml-auto flex items-center gap-1">
            {(['allOf', 'anyOf', 'oneOf'] as const).map((key) =>
              counts[key] > 0 ? (
                <Badge key={key} variant="info" className="px-1.5 py-0 text-[9px]">
                  {key}:{counts[key]}
                </Badge>
              ) : null,
            )}
            {counts.not > 0 ? (
              <Badge variant="info" className="px-1.5 py-0 text-[9px]">
                not
              </Badge>
            ) : null}
          </span>
        )}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-primary-border/60 bg-primary-muted/20 p-3">
          {ARRAY_COMPOSITION_KEYWORDS.map((key) => (
            <div key={key} className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-text/55">
                {key}
              </p>
              <CompositionList pointer={ROOT_POINTER} keyword={key} />
            </div>
          ))}

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-text/55">
              not
            </p>
            <NotCompositionEditor pointer={ROOT_POINTER} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
