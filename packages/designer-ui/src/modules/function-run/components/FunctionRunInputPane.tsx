import type { PseudoViewDelegate } from '@burgan-tech/pseudo-ui';

import { PseudoUiOrJsonBlock } from '../../quick-run/pseudo-ui/PseudoUiOrJsonBlock';
import type { SchemaResolver } from '../../quick-run/pseudo-ui/createDataSchemaResolver';
import type { ViewResponse } from '../../quick-run/types/quickrun.types';
import { Tabs, TabsList, TabsTrigger } from '../../../ui/Tabs';
import type { RunMode } from '../functionRunPayload';
import { FunctionRunPayloadEditor, type FunctionRunPayloadEditorProps } from './FunctionRunPayloadEditor';
import { FunctionRunViewSection } from './FunctionRunViewSection';

export interface FunctionRunInputPaneProps {
  mode: RunMode;
  onModeChange: (next: RunMode) => void;
  hasInputView: boolean;
  /**
   * True when `/info` declared an input view but the adapted content never
   * arrived — see `computeInputViewAvailability`'s `declaredButUnavailable`.
   * Distinct from `hasInputView` (`false` in both this case and the "no view
   * declared at all" case) so the section can show an explanatory error
   * instead of silently rendering nothing.
   */
  inputViewDeclaredButUnavailable?: boolean;
  /**
   * Whether the payload editor may be offered at all — false for a verb
   * that carries no body (GET/DELETE; see `carriesBody` in
   * `functionRunPayload.ts`). A `GET` cannot take a request body, so
   * offering a payload editor for it would be misleading.
   */
  payloadAvailable: boolean;
  inputView: ViewResponse | null;
  onViewFormChange: (data: Record<string, unknown>) => void;
  payloadEditorProps: FunctionRunPayloadEditorProps;
  /**
   * Wires the view's own submit button (and any `x-lov`/`x-lookup` dropdown)
   * to the shell's single Invoke path — see `createFunctionRunPseudoDelegate`.
   * Optional so a caller that genuinely has none (there isn't one today,
   * but keeping this optional matches `PseudoUiOrJsonBlock`'s own contract)
   * still renders a usable, if inert, view.
   */
  delegate?: PseudoViewDelegate;
  resolveSchema?: SchemaResolver;
}

const NO_INPUT_VIEW_REASON = 'This function declares no input view';

/**
 * View | Payload toggle for the function's input.
 *
 * Payload is reachable whenever the selected verb can carry one — free input
 * is never taken away from a body-bearing verb. View is what gets disabled,
 * with a stated reason, when the contract declares no input view.
 *
 * The runner still owns Invoke: the rendered view's own submit button (if
 * any) reaches `functions/invoke` through `delegate.onAction('submit', …)`,
 * which the shell wires to its own `handleInvoke` — the same call the
 * endpoint bar's Send button makes (see `createFunctionRunPseudoDelegate`).
 * There is exactly one send path, just two doors into it. `onFormChange`
 * (on `PseudoUiOrJsonBlock`/`PseudoUiViewSurface`) keeps the store's
 * `viewFormData` in sync on every keystroke regardless of which door is
 * used, so either one sends the latest values.
 *
 * When `payloadAvailable` is false (a body-less verb), there is at most one
 * usable mode left (View, if declared) — the two-way toggle is not rendered
 * at all in that case, and the pane falls straight through to whatever View
 * has (or nothing, if the function also declares no view — the dedicated
 * query-string input is the whole input surface for that combination, which
 * is fine).
 *
 * The toggle itself is `ui/Tabs`, not a bespoke pill — this used to be one of
 * three competing toggle idioms in this module (alongside `ui/Tabs` proper
 * and `ViewModeToggle`); consolidating onto `ui/Tabs` here, the same
 * component the new request tab strip (`FunctionRunRequestTabs`) uses,
 * retires it. Only the `TabsList`/`TabsTrigger` chrome is used — the actual
 * View/Payload content below is rendered manually off `effectiveMode`, not
 * via `TabsContent`, since this pane's rendering rules (nothing at all when
 * Payload is unavailable and no view exists either) do not map cleanly onto
 * "one of these two panes is always mounted".
 */
export function FunctionRunInputPane({
  mode,
  onModeChange,
  hasInputView,
  inputViewDeclaredButUnavailable = false,
  payloadAvailable,
  inputView,
  onViewFormChange,
  payloadEditorProps,
  delegate,
  resolveSchema,
}: FunctionRunInputPaneProps) {
  // Only a genuine two-way choice when Payload is actually offerable —
  // otherwise there is nothing to toggle between (View is either the only
  // option or, with no declared view either, not an option at all).
  const showToggle = payloadAvailable;
  const effectiveMode: RunMode = payloadAvailable ? mode : 'view';

  return (
    <div className="flex flex-col gap-2">
      {showToggle ? (
        <Tabs value={mode} onValueChange={(next) => onModeChange(next as RunMode)}>
          <TabsList variant="default" noBorder aria-label="Function input mode" className="h-7 w-fit gap-1 rounded-md p-0.5">
            <TabsTrigger
              value="view"
              variant="default"
              noBorder
              disabled={!hasInputView}
              title={hasInputView ? undefined : NO_INPUT_VIEW_REASON}
              className="rounded px-2.5 py-1 text-[10px] font-semibold">
              View
            </TabsTrigger>
            <TabsTrigger value="payload" variant="default" noBorder className="rounded px-2.5 py-1 text-[10px] font-semibold">
              Payload
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {showToggle && !hasInputView ? (
        <p className="text-muted-foreground text-[10px]">
          {NO_INPUT_VIEW_REASON} — use Payload instead.
        </p>
      ) : null}

      {effectiveMode === 'view' ? (
        // Genuinely nothing to show (no view declared, and none was ever
        // declared-but-unavailable either) stays a blank pane — the
        // dedicated query-string input is the whole input surface for that
        // combination (see this file's own doc comment). The section chrome
        // below is only worth showing once there is something to say about
        // the view: it exists, or it was declared but failed to load.
        hasInputView || inputViewDeclaredButUnavailable ? (
          <FunctionRunViewSection
            title="Input view"
            view={inputView}
            error={
              inputViewDeclaredButUnavailable
                ? 'This function declares an input view, but it could not be loaded.'
                : null
            }
            emptyMessage={NO_INPUT_VIEW_REASON}>
            {inputView ? (
              <PseudoUiOrJsonBlock
                view={inputView}
                jsonValue={inputView.content}
                displayContent=""
                ariaLabel="Function input view"
                integrationMode="simulation"
                panelStorageScope="function-run-input"
                surfaceClassName="min-h-[200px]"
                delegate={delegate}
                resolveSchema={resolveSchema}
                onFormChange={onViewFormChange}
              />
            ) : null}
          </FunctionRunViewSection>
        ) : null
      ) : (
        <FunctionRunPayloadEditor {...payloadEditorProps} />
      )}
    </div>
  );
}
