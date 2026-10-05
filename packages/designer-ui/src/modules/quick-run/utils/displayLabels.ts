import type {
  FlowLabelsMap,
  RuntimeLabel,
  StateTimeout,
  TransitionInfo,
  TransitionTarget,
} from '../types/quickrun.types';
import { pickLabel, stateTransitionLabelKey } from './extractLabelsMap';

/**
 * Display-text resolution for Quick Run. Order: labels the runtime sends
 * (0.0.99+), then the local workflow file, then the raw key — so an older
 * runtime keeps today's behaviour.
 */

export function transitionDisplayLabel(
  transition: Pick<TransitionInfo, 'name' | 'labels'>,
  flowLabels: FlowLabelsMap | null | undefined,
  fromState?: string,
): string {
  return (
    pickLabel(transition.labels) ??
    (fromState ? flowLabels?.stateTransitions?.[stateTransitionLabelKey(fromState, transition.name)] : undefined) ??
    flowLabels?.transitions[transition.name] ??
    transition.name
  );
}

export function stateDisplayLabel(
  stateKey: string,
  flowLabels: FlowLabelsMap | null | undefined,
  runtimeLabels?: readonly RuntimeLabel[] | null,
): string {
  if (stateKey === '$start') return pickLabel(runtimeLabels) ?? 'Starting…';
  return pickLabel(runtimeLabels) ?? flowLabels?.states[stateKey] ?? stateKey;
}

/** Wraps the pre-0.0.99 string form of `timeout.target` as `{ key }`. */
export function normalizeTarget(target: string | TransitionTarget | null | undefined): TransitionTarget | undefined {
  if (target == null) return undefined;
  if (typeof target === 'string') return { key: target };
  if (typeof target === 'object' && typeof target.key === 'string') return target;
  return undefined;
}

export function normalizeTimeoutTarget(timeout: Pick<StateTimeout, 'target'>): TransitionTarget | undefined {
  return normalizeTarget(timeout.target);
}

export function targetDisplayLabel(
  target: TransitionTarget | undefined,
  flowLabels: FlowLabelsMap | null | undefined,
): string | undefined {
  if (!target) return undefined;
  return stateDisplayLabel(target.key, flowLabels, target.labels);
}
