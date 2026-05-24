/**
 * R21: kind-grouped renderer for the "Available Transitions" section
 * of the Quick Runner instance dashboard.
 *
 * Engine responses now carry a `kind` on each `TransitionInfo`. The
 * dashboard used to render two flat lists (`transitions` +
 * `sharedTransitions`); we now merge them, tag missing kinds with a
 * safe fallback (`stateTransition` for the regular list,
 * `sharedTransition` for the shared list), sort by the priority
 * declared in `TRANSITION_KIND_STYLES`, and render each kind as its
 * own subsection with colour-coded buttons + a small kind badge.
 *
 * Visual contract:
 *   - Each subsection has a label (e.g. "Shared", "Cancel", "Timeout")
 *     in the same `text-muted-text` tone as the section header.
 *   - Buttons use Forge palette tokens so the colour tracks light /
 *     dark theme without per-render branching.
 *   - The Manual button keeps its dashed appearance and lives in the
 *     primary `stateTransition` group when present, since that's the
 *     row users scan first.
 *
 * The component is presentation-only — it does not own loading state,
 * polling, or transition triggers. The parent dashboard passes the
 * label table + click handler in.
 */

import { useMemo } from 'react';

import { type FlowLabelsMap, type TransitionInfo, TRANSITION_KINDS, type TransitionKind } from '../types/quickrun.types';
import { kindStyle, resolveTransitionKind } from './transitionKindStyles';

export interface AvailableTransitionsProps {
  transitions: readonly TransitionInfo[];
  sharedTransitions: readonly TransitionInfo[];
  flowLabels: FlowLabelsMap | null;
  onTransitionClick: (transition: TransitionInfo) => void;
  /** Whether the "+ Manual" button is rendered (active instances only). */
  showManual: boolean;
  onManualClick: () => void;
  /** Disable all buttons while a transition / state refresh is in flight. */
  disabled: boolean;
}

interface NormalizedTransition {
  info: TransitionInfo;
  kind: TransitionKind;
}

export function AvailableTransitions({
  transitions,
  sharedTransitions,
  flowLabels,
  onTransitionClick,
  showManual,
  onManualClick,
  disabled,
}: AvailableTransitionsProps) {
  // Merge + normalize kinds. Legacy responses without `kind` keep the
  // bucket they arrived in so the visual grouping doesn't suddenly
  // change for engine versions that haven't started emitting kinds.
  const grouped = useMemo(() => {
    const all: NormalizedTransition[] = [
      ...transitions.map((t) => ({ info: t, kind: resolveTransitionKind(t.kind, 'stateTransition') as TransitionKind })),
      ...sharedTransitions.map((t) => ({ info: t, kind: resolveTransitionKind(t.kind, 'sharedTransition') as TransitionKind })),
    ];
    const byKind = new Map<TransitionKind, NormalizedTransition[]>();
    for (const item of all) {
      const bucket = byKind.get(item.kind) ?? [];
      bucket.push(item);
      byKind.set(item.kind, bucket);
    }
    return TRANSITION_KINDS.map((kind) => ({
      kind,
      items: byKind.get(kind) ?? [],
    })).filter((group) => group.items.length > 0 || (group.kind === 'stateTransition' && showManual));
  }, [transitions, sharedTransitions, showManual]);

  if (grouped.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase text-muted-text">Available Transitions</p>
      {grouped.map(({ kind, items }) => {
        const style = kindStyle(kind);
        return (
          <div key={kind} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badgeClass}`}>
                {style.label}
              </span>
              <span className="text-[10px] text-muted-text">{style.description}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map(({ info }) => (
                <button
                  key={`${kind}-${info.name}`}
                  className={style.buttonClass}
                  onClick={() => onTransitionClick(info)}
                  disabled={disabled}
                  title={style.description}
                >
                  {style.glyph ? `${style.glyph} ` : ''}
                  {flowLabels?.transitions[info.name] ?? info.name}
                </button>
              ))}
              {kind === 'stateTransition' && showManual && (
                <button
                  className="rounded border border-dashed border-primary-border px-3 py-1.5 text-xs text-muted-text hover:border-primary-border-hover hover:text-foreground disabled:opacity-50"
                  onClick={onManualClick}
                  disabled={disabled}
                  title="Fire a transition by name (session-only, not persisted)"
                >
                  + Manual
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
