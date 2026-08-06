import { Button } from '../../../ui/Button';
import { KeyValueEditor, type KeyValuePair } from '../../../ui/KeyValueEditor';
import { computeShadowedHeaderKeys } from '../functionRunHeaders';

export interface FunctionRunHeadersTabProps {
  /** From `useToolHeadersStore` — the Forge-wide set shared with Quick Run. Shown read-only here. */
  toolWideHeaders: Record<string, string>;
  /**
   * `areToolHeadersHostOwned()` — true in the extension, where
   * `DesignerPanel`/`FunctionRunApp` inject this value into
   * `window.__VNEXT_CONFIG__` once per panel build/open and
   * `ToolHeadersSync` re-reads it on every mount, with no write-back path
   * from the webview. An in-app editor there would silently discard
   * whatever the user typed the next time the panel opens, so this tab does
   * not offer one in that case — see `onEditToolWideHeaders`'s doc comment.
   */
  toolWideHeadersHostOwned: boolean;
  /** This run's own headers — the shell's existing `sessionHeaders`. */
  sessionHeaders: Record<string, string>;
  onSessionHeadersChange: (next: Record<string, string>) => void;
  /**
   * Opens the shell's existing `HeadersConfigDialog`, scoped to editing the
   * Forge-wide set. Only ever called when `toolWideHeadersHostOwned` is
   * false — this tab renders a location hint instead of an Edit button when
   * it is true, so the dialog is never offered somewhere it could not
   * actually save.
   */
  onEditToolWideHeaders: () => void;
}

function toPairs(record: Record<string, string>): KeyValuePair[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

/**
 * Two visible header layers, lower-priority one first — the same order
 * `mergeQuickRunHeaders` resolves a collision in (`toolWide` is its
 * lowest-priority layer, `sessionHeaders` a higher one), so the layout reads
 * top-to-bottom the way the merge itself would.
 *
 * The Forge-wide set is always shown read-only: it is shared with Quick Run
 * through `useToolHeadersStore`, so an inline editor here would silently
 * change every other surface that reads the same store. Whether an "Edit"
 * control is offered at all depends on `toolWideHeadersHostOwned`:
 *
 * - Not host-owned (the web shell): `useToolHeadersStore`'s persisted copy
 *   IS the truth, so "Edit" opens the shell's existing `HeadersConfigDialog`
 *   — the one place in this app that already commits to that store.
 * - Host-owned (the extension): the host overwrites the store from its own
 *   injected value on every panel open, so a save through that same dialog
 *   would work for the rest of the session and then quietly vanish. Offering
 *   the dialog there would be an editor that discards edits — worse than
 *   not offering one — so this tab instead names where the value actually
 *   lives.
 *
 * This run's headers are inline-editable via `KeyValueEditor`, no modal,
 * since they are scoped to this shell and nothing else reads them. Their
 * `onChange` deliberately does **not** filter a blank-key row before writing
 * `sessionHeaders` — see `sanitizeHeaderRecord`'s doc comment for why that
 * filtering happens only where headers are about to be sent, not here.
 */
export function FunctionRunHeadersTab({
  toolWideHeaders,
  toolWideHeadersHostOwned,
  sessionHeaders,
  onSessionHeadersChange,
  onEditToolWideHeaders,
}: FunctionRunHeadersTabProps) {
  const toolWidePairs = toPairs(toolWideHeaders);
  const sessionPairs = toPairs(sessionHeaders);
  const shadowedKeys = computeShadowedHeaderKeys(sessionHeaders, toolWideHeaders);

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            Forge-wide headers
          </span>
          {toolWideHeadersHostOwned ? null : (
            <Button type="button" variant="ghost" size="sm" onClick={onEditToolWideHeaders}>
              Edit
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-[10px]">
          Shared with Quick Run for this workspace. Sent with every request unless a header below overrides it.
        </p>
        {toolWideHeadersHostOwned ? (
          <p className="text-muted-foreground text-[10px]">
            Configured in vNext Forge Tools → Settings → Quick Run → Global Headers.
          </p>
        ) : null}
        {toolWidePairs.length > 0 ? (
          <KeyValueEditor pairs={toolWidePairs} onChange={() => undefined} readOnly />
        ) : (
          <p className="text-muted-foreground text-[10px] italic">No Forge-wide headers configured.</p>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
          This run&apos;s headers
        </span>
        <KeyValueEditor
          pairs={sessionPairs}
          onChange={(next) => onSessionHeadersChange(Object.fromEntries(next.map((p) => [p.key, p.value])))}
          keyPlaceholder="Header name"
          valuePlaceholder="Value"
          addLabel="Add header"
        />
        {shadowedKeys.length > 0 ? (
          <p className="text-warning-text text-[10px]" role="status">
            {shadowedKeys.length === 1
              ? `"${shadowedKeys[0]}" overrides the Forge-wide header of the same name.`
              : `${shadowedKeys.join(', ')} override Forge-wide headers of the same name.`}
          </p>
        ) : null}
      </section>
    </div>
  );
}
