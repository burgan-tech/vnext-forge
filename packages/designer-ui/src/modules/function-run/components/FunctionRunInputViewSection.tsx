import type { PseudoViewDelegate } from '@burgan-tech/pseudo-ui';

import { PseudoUiOrJsonBlock } from '../../quick-run/pseudo-ui/PseudoUiOrJsonBlock';
import type { SchemaResolver } from '../../quick-run/pseudo-ui/createDataSchemaResolver';
import type { ViewResponse } from '../../quick-run/types/quickrun.types';
import { FunctionRunViewSection } from './FunctionRunViewSection';

export interface FunctionRunInputViewSectionProps {
  /** The adapted input view, or `null` while loading / when it failed to load. */
  view: ViewResponse | null;
  loading: boolean;
  /** True when `/info` declared an input view but the fetch produced nothing usable. */
  declaredButUnavailable: boolean;
  /** Where this view's values go on Send — see `resolveInputViewDestination`. */
  destination: 'body' | 'query' | 'unused';
  onFormChange: (data: Record<string, unknown>) => void;
  /**
   * Wires the view's own button(s) to the shell's single Invoke path — see
   * `createFunctionRunPseudoDelegate`. This is what makes a purely
   * informational view with a "Run" button work.
   */
  delegate?: PseudoViewDelegate;
  resolveSchema?: SchemaResolver;
}

const DESTINATION_NOTE: Record<FunctionRunInputViewSectionProps['destination'], string> = {
  body: "This view's values are sent as the request body.",
  query: 'This verb carries no body, so this view’s values are sent as query parameters.',
  unused:
    'The Body tab is set to Payload, so Send uses the payload editor — not the values on this view.',
};

/**
 * The function's declared input view, rendered as a first-class section of the
 * request pane rather than as the contents of a tab.
 *
 * Always visible whenever `/info` declares one, for every verb. That is the
 * point, not a layout preference: a view is the function's own UI surface, and
 * it need not be a form at all — it can be informational, with a button inside
 * it that triggers the call through `delegate.onAction('submit', …)`. Nesting
 * it under Body hid it outright for GET/DELETE, because
 * `FunctionRunRequestTabs` does not render that tab for a body-less verb; and
 * nesting it under a verb-dependent tab at all would mean the user has to know
 * which tab to open before they can see what the function is asking for.
 *
 * It sits above the Params | Headers | Body strip for the same reason the
 * scope-id fields do (see `FunctionRunShell`): those tabs compose the *raw*
 * request, while this is what the function itself declares.
 *
 * What the values contribute still depends on the verb and the body-source
 * choice, so that is stated inline rather than left to be inferred — see
 * `resolveInputViewDestination`.
 */
export function FunctionRunInputViewSection({
  view,
  loading,
  declaredButUnavailable,
  destination,
  onFormChange,
  delegate,
  resolveSchema,
}: FunctionRunInputViewSectionProps) {
  return (
    <FunctionRunViewSection
      title="Input view"
      view={view}
      loading={loading}
      error={
        declaredButUnavailable
          ? 'This function declares an input view, but it could not be loaded. Use the fields below instead.'
          : null
      }
      emptyMessage="This function declares no input view">
      {view ? (
        <div className="flex flex-col gap-2">
          <PseudoUiOrJsonBlock
            view={view}
            jsonValue={view.content}
            displayContent=""
            ariaLabel="Function input view"
            integrationMode="simulation"
            panelStorageScope="function-run-input"
            surfaceClassName="min-h-[200px]"
            delegate={delegate}
            resolveSchema={resolveSchema}
            onFormChange={onFormChange}
          />
          <p className="text-muted-foreground text-[10px]">{DESTINATION_NOTE[destination]}</p>
        </div>
      ) : null}
    </FunctionRunViewSection>
  );
}
