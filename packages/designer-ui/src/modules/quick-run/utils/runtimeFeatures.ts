import { RUNTIME_0_0_99, runtimeAtLeast } from '@vnext-forge-studio/vnext-types';

import { useQuickRunStore } from '../store/quickRunStore';

/**
 * Minimum runtime version per version-gated Quick Run surface. Every entry
 * first ships in runtime 0.0.99 — `vnext-meta` `since` values that say
 * otherwise are wrong (the v0.0.98 tag only carries the interaction backport).
 */
export const RUNTIME_FEATURE_MIN = {
  correlationTree: RUNTIME_0_0_99,
  executionType: RUNTIME_0_0_99,
  elementMetrics: RUNTIME_0_0_99,
  functionMetrics: RUNTIME_0_0_99,
} as const;

export type RuntimeFeature = keyof typeof RUNTIME_FEATURE_MIN;

/** `true` / `false` when the version is known, `undefined` when it is not. */
export function runtimeSupports(version: string | null | undefined, feature: RuntimeFeature): boolean | undefined {
  return runtimeAtLeast(version, RUNTIME_FEATURE_MIN[feature]);
}

export function useRuntimeSupports(feature: RuntimeFeature): boolean | undefined {
  const version = useQuickRunStore((s) => s.runtimeVersion);
  return runtimeSupports(version, feature);
}
