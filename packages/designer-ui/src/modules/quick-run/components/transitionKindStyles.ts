/**
 * R21: visual + semantic descriptors for `TransitionInfo.kind` and
 * `StateResponse.stateType`. Centralised here so the dashboard chips,
 * future history rows, and any other transition surface stay in sync
 * without each component redefining colours / labels / orderings.
 *
 * Tailwind classes use the Forge token system established in R18/R19
 * (`primary-*`, `secondary-*`, `destructive-*`, `warning-*`, `info-*`)
 * so the colours track light/dark mode automatically.
 */

import { type TransitionKind } from '../types/quickrun.types';

export interface TransitionKindStyle {
  /** Sort order inside the Available Transitions section. */
  order: number;
  /** Plain-language label shown as the group subheader. */
  label: string;
  /** Short title attribute hint shown on every button in the group. */
  description: string;
  /** Tailwind classes for the primary (default) state of the button. */
  buttonClass: string;
  /** Tailwind classes for the small inline kind badge next to the label. */
  badgeClass: string;
  /** Optional leading glyph rendered before the label inside the button. */
  glyph?: string;
}

/**
 * Style registry, keyed by `TransitionKind`. Use `kindStyle(kind)` to
 * resolve unknown kinds back to the safe `stateTransition` default —
 * an older engine response without `kind` lands on the same lane as
 * the most common transition.
 */
export const TRANSITION_KIND_STYLES: Record<TransitionKind, TransitionKindStyle> = {
  stateTransition: {
    order: 0,
    label: 'State',
    description: 'Advance the instance to the next state',
    buttonClass:
      'rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-xs font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50',
    badgeClass: 'bg-primary-muted text-primary-text',
    glyph: '▶',
  },
  sharedTransition: {
    order: 1,
    label: 'Shared',
    description: 'Available across multiple states',
    buttonClass:
      'rounded border border-secondary-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-text hover:bg-secondary-hover disabled:opacity-50',
    badgeClass: 'bg-secondary-muted text-secondary-text',
    glyph: '↺',
  },
  'update-parent-data': {
    order: 2,
    label: 'Update Parent',
    description: 'Sub-flow → parent data sync',
    buttonClass:
      'rounded border border-info-border bg-info-surface px-3 py-1.5 text-xs font-medium text-info-text hover:bg-info-hover disabled:opacity-50',
    badgeClass: 'bg-info text-info-text',
    glyph: '↑',
  },
  exit: {
    order: 3,
    label: 'Exit',
    description: 'Leave the current flow',
    buttonClass:
      'rounded border border-warning-border bg-warning-surface px-3 py-1.5 text-xs font-medium text-warning-text hover:bg-warning-hover disabled:opacity-50',
    badgeClass: 'bg-warning text-warning-text',
    glyph: '⏏',
  },
  cancel: {
    order: 4,
    label: 'Cancel',
    description: 'Cancel the instance',
    buttonClass:
      'rounded border border-destructive-border bg-destructive-surface px-3 py-1.5 text-xs font-medium text-destructive-icon hover:bg-destructive-muted hover:text-destructive-foreground-hover disabled:opacity-50',
    badgeClass: 'bg-destructive-muted text-destructive-icon',
    glyph: '✕',
  },
  $timeout: {
    order: 5,
    label: 'Timeout',
    description: 'Fired automatically by the engine after a timeout window',
    buttonClass:
      'rounded border border-primary-border bg-primary px-3 py-1.5 text-xs font-medium text-muted-text hover:bg-primary-hover hover:text-foreground disabled:opacity-50',
    badgeClass: 'bg-muted text-muted-text',
    glyph: '⏱',
  },
};

const KNOWN_KINDS = new Set<TransitionKind>(Object.keys(TRANSITION_KIND_STYLES) as TransitionKind[]);

/**
 * Resolve a raw `kind` string (possibly `undefined` or unknown) into
 * a styled descriptor. Caller passes the bucket the transition came
 * from (`stateTransition` for `transitions[]`, `sharedTransition` for
 * `sharedTransitions[]`) as a fallback for legacy engine responses
 * that don't yet emit `kind`.
 */
export function resolveTransitionKind(
  raw: string | undefined,
  fallback: TransitionKind,
): TransitionKind {
  if (raw && KNOWN_KINDS.has(raw as TransitionKind)) return raw as TransitionKind;
  return fallback;
}

export function kindStyle(kind: TransitionKind): TransitionKindStyle {
  return TRANSITION_KIND_STYLES[kind];
}

/**
 * R21: visual descriptor for `StateResponse.stateType`. Chip colour
 * mirrors the lifecycle phase (start = info, end = success, etc.) so
 * the user can read the flow context without consulting docs.
 */
export interface StateTypeStyle {
  label: string;
  className: string;
  description: string;
}

export const STATE_TYPE_STYLES: Record<string, StateTypeStyle> = {
  initial: {
    label: 'Initial',
    className: 'border border-info-border bg-info-surface text-info-text',
    description: 'Entry point of the workflow',
  },
  intermediate: {
    label: 'Intermediate',
    className: 'border border-primary-border bg-primary-muted text-primary-text',
    description: 'In-progress workflow step',
  },
  finish: {
    label: 'Finish',
    className: 'border border-success-border bg-success-surface text-success-text',
    description: 'Terminal state — the workflow ended here',
  },
  subflow: {
    label: 'Sub-flow',
    className: 'border border-info-border bg-info-surface text-info-text',
    description: 'Delegated to a child workflow instance',
  },
  // Vocabulary uses both casings; surface them as the same chip.
  subFlow: {
    label: 'Sub-flow',
    className: 'border border-info-border bg-info-surface text-info-text',
    description: 'Delegated to a child workflow instance',
  },
  wizard: {
    label: 'Wizard',
    className: 'border border-secondary-border bg-secondary text-secondary-text',
    description: 'Multi-page wizard step',
  },
};

export function stateTypeStyle(stateType: string | undefined): StateTypeStyle | null {
  if (!stateType) return null;
  return STATE_TYPE_STYLES[stateType] ?? null;
}
