import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../../ui/Tabs';
import {
  ARRAY_COMPOSITION_KEYWORDS,
  countCompositionItems,
  type ArrayCompositionKeyword,
} from '../../../../model/compositionKeywords';
import { type JsonPointer } from '../../../../model/jsonPointer';
import { useSchemaNode } from '../../../../hooks/useSchemaNode';
import { CompositionList } from '../../composition/CompositionList';
import { NotCompositionEditor } from '../../composition/NotCompositionEditor';

interface CompositionTabProps {
  pointer: JsonPointer;
}

type SegmentKey = ArrayCompositionKeyword | 'not';

const SEGMENT_LABELS: Record<SegmentKey, string> = {
  allOf: 'allOf',
  anyOf: 'anyOf',
  oneOf: 'oneOf',
  not: 'not',
};

/**
 * Composition keyword editor. Renders a horizontal segmented control for
 * `allOf | anyOf | oneOf | not`, each segment showing a count badge so the
 * user sees at a glance which keywords are active on the current node.
 * Adding the first subschema auto-creates the array; removing the last
 * item auto-deletes the keyword (see mutators) so saved JSON stays minimal.
 */
export function CompositionTab({ pointer }: CompositionTabProps) {
  const { node } = useSchemaNode(pointer);
  const [segment, setSegment] = useState<SegmentKey>('allOf');

  if (!node) {
    return (
      <div className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/40 p-4 text-center text-[11px] text-primary-text/65">
        Select a property in the tree to edit its composition rules.
      </div>
    );
  }

  const counts: Record<SegmentKey, number> = {
    allOf: countCompositionItems(node, 'allOf'),
    anyOf: countCompositionItems(node, 'anyOf'),
    oneOf: countCompositionItems(node, 'oneOf'),
    not: countCompositionItems(node, 'not'),
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-primary-text/65">
        Compose multiple subschemas. `allOf` enforces every subschema, `anyOf` accepts at least one,
        `oneOf` enforces exactly one match, and `not` rejects matches against the subschema.
      </p>

      <Tabs value={segment} onValueChange={(value) => setSegment(value as SegmentKey)}>
        <TabsList variant="default" className="h-8 w-fit gap-1 p-1">
          {[...ARRAY_COMPOSITION_KEYWORDS, 'not' as const].map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              variant="default"
              className="px-2 py-1 text-[10px]">
              {SEGMENT_LABELS[key]}
              {counts[key] > 0 ? (
                <span className="ml-1 rounded-full bg-info-muted px-1.5 py-0 text-[9px] font-semibold text-info-text">
                  {counts[key]}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {ARRAY_COMPOSITION_KEYWORDS.map((key) => (
          <TabsContent key={key} value={key} className="mt-3">
            <CompositionList pointer={pointer} keyword={key} />
          </TabsContent>
        ))}

        <TabsContent value="not" className="mt-3">
          <NotCompositionEditor pointer={pointer} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
