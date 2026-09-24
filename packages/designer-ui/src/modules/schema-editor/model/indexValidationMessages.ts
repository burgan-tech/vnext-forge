import type { ValidationEntry } from '../../save-component/validateBeforeWrite';
import { findIndexViolations, getIndexAnalysis } from './indexEligibility';

const SCHEMA_PATH = '/attributes/schema';

/**
 * AJV errors produced by the vnext-schema `x-indexed` rules: everything below
 * `attributes.schema` (master and non-master rules only constrain index
 * metadata there), the union/boolean noise on `attributes.schema` itself (its
 * own `minProperties` / `type: object` errors are kept), and the root
 * `if/then/else` that selects master vs non-master.
 */
function isIndexRuleNoise(entry: ValidationEntry): boolean {
  if (entry.path === '') return entry.params?.failingKeyword !== undefined;
  if (entry.path.startsWith(`${SCHEMA_PATH}/`)) return true;
  if (entry.path === SCHEMA_PATH) return entry.params?.limit === undefined && entry.params?.type !== 'object';
  return false;
}

/**
 * Save-time messages for a schema component: when Forge's mirror of the runtime
 * rules finds `x-indexed` problems, they replace the AJV if/then noise with one
 * readable entry per field. Otherwise the AJV errors pass through unchanged.
 */
export function translateIndexValidationErrors(
  componentJson: Record<string, unknown> | null | undefined,
  errors: readonly ValidationEntry[],
): ValidationEntry[] {
  const violations = findIndexViolations(getIndexAnalysis(componentJson));
  if (violations.length === 0) return [...errors];
  return [
    ...violations.map((v) => ({ path: `${SCHEMA_PATH}${v.pointer}`, message: v.message })),
    ...errors.filter((e) => !isIndexRuleNoise(e)),
  ];
}
