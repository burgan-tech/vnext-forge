import { memo } from 'react';
import { Plus, Sparkles, StickyNote } from 'lucide-react';

interface EmptyCanvasGuideProps {
  onAddState: () => void;
  /** Total state count — placeholder is rendered only when this is 0. */
  stateCount: number;
}

/**
 * Welcome card shown when a workflow has zero user states. Acts
 * as a guided start: a single "Add Initial State" CTA plus a
 * couple of hints about non-obvious canvas features (sticky
 * notes, keyboard shortcuts) so first-time users discover them
 * organically.
 *
 * Hidden the moment any state is added (`stateCount > 0`). The
 * placeholder lives at the canvas's geometric center, anchored
 * via fixed positioning relative to the wrapper.
 */
export const EmptyCanvasGuide = memo(function EmptyCanvasGuide({
  onAddState,
  stateCount,
}: EmptyCanvasGuideProps) {
  if (stateCount > 0) return null;

  return (
    <div
      role="region"
      aria-label="Empty canvas — add your first state"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <div className="pointer-events-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface/95 px-6 py-5 text-center shadow-lg backdrop-blur-sm">
        <div className="flex size-12 items-center justify-center rounded-xl bg-action/10 text-action">
          <Sparkles size={22} strokeWidth={2.25} />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">
            Your workflow is empty
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Start by dropping an <strong>Initial</strong> state — every workflow needs exactly one
            entry point.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddState}
          className="flex items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 text-[12px] font-semibold text-action-foreground shadow-md transition-all duration-150 hover:bg-action-hover active:scale-[0.97]"
        >
          <Plus size={14} strokeWidth={2.5} />
          Add Initial State
        </button>

        <div className="mt-1 flex w-full flex-col gap-1.5 border-t border-border pt-3 text-left">
          <Tip
            icon={<StickyNote size={12} />}
            text="Double-click anywhere on the canvas to drop a sticky note."
          />
          <Tip
            icon={<span className="font-mono text-[10px]">?</span>}
            text="Press ? to see every keyboard shortcut."
          />
        </div>
      </div>
    </div>
  );
});

function Tip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="leading-snug">{text}</span>
    </div>
  );
}
