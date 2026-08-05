import type { ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import type { RequestTabId } from '../functionRunPayload';

export interface FunctionRunRequestTabsProps {
  /**
   * The tab to actually show — pass the *already-resolved* value from
   * `resolveEffectiveRequestTab`, not the store's raw `activeRequestTab`.
   * This component does not re-derive that fallback itself: if a caller
   * passes `'body'` while `bodyAvailable` is false, Radix has no
   * trigger/content pair for that value and shows nothing selected, exactly
   * the "showing nothing" outcome `resolveEffectiveRequestTab` exists to
   * avoid — so that resolution has to happen before this component is asked
   * to render, not inside it.
   */
  activeTab: RequestTabId;
  onTabChange: (tab: RequestTabId) => void;
  /** False for a verb that carries no body (`carriesBody`) — Body does not exist as a tab at all, not merely disabled. */
  bodyAvailable: boolean;
  paramsContent: ReactNode;
  headersContent: ReactNode;
  bodyContent: ReactNode;
}

const TAB_TRIGGER_CLASS = 'rounded px-2.5 py-1 text-[10px] font-semibold';

/**
 * The Params | Headers | Body strip that replaces the input pane's old
 * full-width pill and the toolbar's separate query-string/scope-id fields —
 * one consolidated toggle idiom for request composition instead of three.
 *
 * Built on `ui/Tabs` rather than a bespoke `role="tablist"`: this package's
 * `DetailPanel.tsx` already proves `ui/Tabs` compacts down to `h-8`/
 * `text-[10px]` cleanly via plain className overrides (`twMerge` lets the
 * override win over the `h-10`/`text-sm` defaults), so there was no need for
 * a second, bespoke tab-strip idiom here. `noBorder` flattens it further, to
 * the segmented-control look this dense a surface wants.
 */
export function FunctionRunRequestTabs({
  activeTab,
  onTabChange,
  bodyAvailable,
  paramsContent,
  headersContent,
  bodyContent,
}: FunctionRunRequestTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as RequestTabId)}>
      <TabsList variant="default" noBorder aria-label="Request section" className="h-7 w-fit gap-1 rounded-md p-0.5">
        <TabsTrigger value="params" variant="default" noBorder className={TAB_TRIGGER_CLASS}>
          Params
        </TabsTrigger>
        <TabsTrigger value="headers" variant="default" noBorder className={TAB_TRIGGER_CLASS}>
          Headers
        </TabsTrigger>
        {bodyAvailable ? (
          <TabsTrigger value="body" variant="default" noBorder className={TAB_TRIGGER_CLASS}>
            Body
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="params">{paramsContent}</TabsContent>
      <TabsContent value="headers">{headersContent}</TabsContent>
      {bodyAvailable ? <TabsContent value="body">{bodyContent}</TabsContent> : null}
    </Tabs>
  );
}
