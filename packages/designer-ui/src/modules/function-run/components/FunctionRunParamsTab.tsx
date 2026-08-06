import { useEffect, useRef, useState } from 'react';

import { Input } from '../../../ui/Input';
import { KeyValueEditor, type KeyValuePair } from '../../../ui/KeyValueEditor';
import { Tabs, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { parseQueryString, stringifyQueryPairs } from '../functionRunPayload';
import { shouldResyncFromValue } from './FunctionRunPayloadEditor';

export type ParamsView = 'table' | 'raw';

export interface FunctionRunParamsTabProps {
  /** The single source of truth `buildInvokeRequest` reads — this tab never introduces a second copy of it. */
  queryString: string;
  onQueryStringChange: (next: string) => void;
  /**
   * Controlled, not local state — mirrors `FunctionRunInputPane`'s own
   * `mode` prop. `renderToStaticMarkup` never runs effects and cannot
   * simulate a click, so the only way this file's test can exercise the
   * raw-text branch at all is for the caller (the shell) to be able to pass
   * it directly.
   */
  view: ParamsView;
  onViewChange: (next: ParamsView) => void;
}

/**
 * Turns the current `queryString` into the KV table's row shape.
 *
 * Goes through the existing `parseQueryString` (a `Record<string, string>`,
 * last-value-wins for a repeated key) rather than a bespoke
 * duplicate-preserving parser: `buildInvokeRequest` already calls
 * `parseQueryString` on the same `queryString` at send time, so a duplicate
 * key is already going to collapse to its last value on the wire regardless
 * of whether this table preserves both rows in the meantime. Reusing the
 * existing, already-tested collapsing behaviour here keeps there being
 * exactly one place that decides what a duplicate key means.
 */
function toPairs(queryString: string): KeyValuePair[] {
  return Object.entries(parseQueryString(queryString)).map(([key, value]) => ({ key, value }));
}

/**
 * Params tab: the query-string input `FunctionRunToolbar` used to own,
 * now editable either as a KV table or as raw text.
 *
 * `queryString` stays the single source of truth (see the shell's
 * `buildInvokeRequest` call) — this component never introduces a second copy
 * of it. The KV table is a *view* onto that string, reconciled through
 * `parseQueryString` / `stringifyQueryPairs`.
 *
 * The table's local `pairs` needs the same protection
 * `FunctionRunPayloadEditor`'s `JsonPayloadField` gives its own text, reused
 * here rather than reinvented: turning `pairs` straight back into
 * `queryString` on every keystroke, with no guard, would mean the very next
 * render recomputes `pairs` from that (necessarily trimmed) `queryString` —
 * `stringifyQueryPairs`, like `parseQueryString`, drops a still-blank key —
 * and the row a user just clicked "Add param" for would vanish before they
 * could type a key into it. `shouldResyncFromValue` / `lastPushedRef` tell an
 * echo of this component's own write apart from a genuine external reset
 * (switching function, or an edit made through the raw-text view instead).
 *
 * The raw-text view needs none of this: it binds directly to `queryString`,
 * which the store never reformats, so there is nothing for it to resync
 * against — the same reasoning that already let the old toolbar's
 * query-string `Input` bind straight to the store with no local buffer.
 */
export function FunctionRunParamsTab({
  queryString,
  onQueryStringChange,
  view,
  onViewChange,
}: FunctionRunParamsTabProps) {
  const [pairs, setPairs] = useState<KeyValuePair[]>(() => toPairs(queryString));
  const lastPushedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldResyncFromValue(queryString, lastPushedRef.current)) return;
    setPairs(toPairs(queryString));
  }, [queryString]);

  function commitPairs(next: KeyValuePair[]) {
    setPairs(next);
    const nextQueryString = stringifyQueryPairs(next);
    lastPushedRef.current = nextQueryString;
    onQueryStringChange(nextQueryString);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[10px]">
          Query parameters sent with every request, regardless of verb.
        </p>
        <Tabs value={view} onValueChange={(next) => onViewChange(next as ParamsView)}>
          <TabsList variant="secondary" noBorder aria-label="Params view" className="h-6 w-fit gap-0.5 rounded-md p-0.5">
            <TabsTrigger value="table" variant="secondary" noBorder className="rounded px-2 py-0.5 text-[10px]">
              Table
            </TabsTrigger>
            <TabsTrigger value="raw" variant="secondary" noBorder className="rounded px-2 py-0.5 text-[10px]">
              Raw
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === 'table' ? (
        <KeyValueEditor
          pairs={pairs}
          onChange={commitPairs}
          keyPlaceholder="Param"
          valuePlaceholder="Value"
          addLabel="Add param"
        />
      ) : (
        <Input
          size="sm"
          placeholder="a=1&b=2"
          aria-label="Query string"
          value={queryString}
          onChange={(e) => onQueryStringChange(e.target.value)}
        />
      )}
    </div>
  );
}
