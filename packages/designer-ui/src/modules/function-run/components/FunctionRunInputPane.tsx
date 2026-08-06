import { Tabs, TabsList, TabsTrigger } from '../../../ui/Tabs';
import type { RunMode } from '../functionRunPayload';
import { FunctionRunPayloadEditor, type FunctionRunPayloadEditorProps } from './FunctionRunPayloadEditor';

export interface FunctionRunInputPaneProps {
  mode: RunMode;
  onModeChange: (next: RunMode) => void;
  /**
   * Whether a usable input view exists — it is rendered by
   * `FunctionRunInputViewSection` above the tab strip, not here. This pane
   * only needs to know whether View is a selectable *body source*.
   */
  hasInputView: boolean;
  /**
   * Whether the payload editor may be offered at all — false for a verb
   * that carries no body (GET/DELETE; see `carriesBody` in
   * `functionRunPayload.ts`). A `GET` cannot take a request body, so
   * offering a payload editor for it would be misleading.
   */
  payloadAvailable: boolean;
  payloadEditorProps: FunctionRunPayloadEditorProps;
}

const NO_INPUT_VIEW_REASON = 'This function declares no input view';

/**
 * The Body tab: which source supplies the request body, and the free payload
 * editor when that source is Payload.
 *
 * This pane no longer renders the input view itself. The view is the
 * function's own declared surface — possibly informational, possibly carrying
 * its own trigger button — so it is always visible above the tab strip
 * (`FunctionRunInputViewSection`), for every verb. Nesting it here hid it
 * outright for GET/DELETE, since `FunctionRunRequestTabs` renders no Body tab
 * for a body-less verb.
 *
 * What survives here is the part that genuinely belongs to the body: with a
 * view declared *and* a body-bearing verb, two candidate bodies exist and
 * something has to decide which one Send uses. That is `mode`, and this
 * toggle is where the user sets it — including for a button pressed inside
 * the view itself, which goes through the same `handleInvoke`
 * (`createFunctionRunPseudoDelegate`) and therefore the same choice.
 *
 * This pane is only rendered for a body-bearing verb (the Body tab does not
 * exist otherwise), so `payloadAvailable` is effectively always true today;
 * it is kept as a prop rather than assumed so the component stays honest
 * about the rule it depends on.
 */
export function FunctionRunInputPane({
  mode,
  onModeChange,
  hasInputView,
  payloadAvailable,
  payloadEditorProps,
}: FunctionRunInputPaneProps) {
  // Only a genuine two-way choice when Payload is offerable and a view exists
  // to choose instead of it.
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
        <p className="text-muted-foreground text-[10px]">
          Send uses the input view&apos;s values — the view is shown above.
        </p>
      ) : (
        <FunctionRunPayloadEditor {...payloadEditorProps} />
      )}
    </div>
  );
}
