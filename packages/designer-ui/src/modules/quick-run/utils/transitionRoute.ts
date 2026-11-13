/**
 * `from → to` for one transition-history row. The runtime omits `toState` when
 * the transition never reached ChangeState — e.g. it lost a resource-lock race
 * and an error boundary rerouted the instance (runtime 0.0.106) — so the row
 * says that instead of printing `undefined`.
 */
export function transitionRoute(fromState: string, toState: string | null | undefined): string {
  return toState ? `${fromState} → ${toState}` : `${fromState} · not completed`;
}

/** The same, phrased for an `aria-label` ("a to b"). */
export function transitionRouteSpoken(fromState: string, toState: string | null | undefined): string {
  return toState ? `${fromState} to ${toState}` : `${fromState}, not completed`;
}
