import { memo } from 'react';
import { GitBranch, Repeat2, Layers, Shield, ListChecks } from 'lucide-react';
import type { LintFinding, WorkflowPattern } from '../utils/workflowLint';

interface WorkflowInsightsProps {
  /**
   * Lint findings — accepted for API stability (FlowCanvas passes
   * them) but not rendered. The host shell's Problems panel
   * already surfaces the same set.
   */
  findings?: LintFinding[];
  patterns: WorkflowPattern[];
  /** Reserved for future re-introduction of a canvas lint pill. */
  onFocusState?: (stateKey: string) => void;
}

/**
 * Floating bottom-left panel that shows lint findings + detected
 * patterns. Collapsed by default to keep the canvas uncluttered;
 * expands on click. Each finding is clickable when it carries a
 * `stateKey` — focuses the canvas on that state.
 *
 * Pattern chips sit in a row at the bottom-right; they're
 * informational only (no click behavior).
 */
export const WorkflowInsights = memo(function WorkflowInsights({
  patterns,
}: WorkflowInsightsProps) {
  // Lint findings are intentionally not surfaced here — the host
  // shell already ships a "Problems" panel (from
  // `workspace-diagnostics/ProblemsSidebarPanel`) that lists the
  // same set. Rendering a second collapsible pill at the bottom-
  // left of the canvas would be visual duplication and crowd the
  // status bar. The `lintWorkflow()` results are still computed
  // by FlowCanvas and stay available to feed the host Problems
  // pipeline when we wire that integration.
  //
  // Pattern chips, on the other hand, are unique to the canvas
  // and have no equivalent in the host shell, so they remain.

  return (
    <>
      {/* Patterns chip row — bottom-right. The `bottom` offset uses
       * the same `--designer-host-status-bar-height` CSS variable as
       * the lint summary on the left, so the chips sit just above
       * the host shell's status bar instead of overlapping its
       * "warning"/"connected" indicators. */}
      {patterns.length > 0 && (
        <div
          role="region"
          aria-label="Detected workflow patterns"
          className="pointer-events-auto fixed right-3 z-20 flex flex-wrap items-center gap-1.5 bottom-[max(1.5rem,calc(var(--designer-host-status-bar-height,0px)+0.75rem))]"
        >
          {patterns.map((p) => (
            <span
              key={p.id}
              title={p.evidence ? `${p.label} — ${p.evidence}` : p.label}
              className="flex items-center gap-1 rounded-full border border-action/40 bg-action/10 px-2 py-0.5 text-[10px] font-semibold text-action"
            >
              <PatternIcon id={p.id} />
              {p.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
});

function PatternIcon({ id }: { id: WorkflowPattern['id'] }) {
  switch (id) {
    case 'approval':
      return <ListChecks size={11} />;
    case 'retry':
      return <Repeat2 size={11} />;
    case 'wizard':
      return <Layers size={11} />;
    case 'saga':
      return <GitBranch size={11} />;
    case 'gate':
      return <Shield size={11} />;
    default:
      return null;
  }
}
