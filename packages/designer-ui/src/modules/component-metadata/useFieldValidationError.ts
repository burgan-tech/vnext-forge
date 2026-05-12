/**
 * Read the latest save-time validation error for a single form field
 * (or section) from `useComponentStore.validationErrors`. Forms feed
 * the returned message into `<Field hint={...}>` and set
 * `aria-invalid` on the input so the global CSS rule paints it red.
 *
 * Path matching is JSON-Pointer friendly:
 *   - `'key'` matches both `'key'` (client-side baseline) and `'/key'`
 *     (server-side AJV `instancePath`)
 *   - Parent paths also match descendants — calling
 *     `useFieldValidationError('attributes')` returns the first error
 *     under `/attributes/...`, so section headers can light up even
 *     when individual sub-field wiring isn't in place yet.
 *
 * Returns `undefined` when no matching error is present.
 */
import { useComponentStore } from '../../store/useComponentStore';

export function useFieldValidationError(fieldPath: string): string | undefined {
  return useComponentStore((state) => {
    for (const err of state.validationErrors) {
      const norm = err.path.replace(/^\//, '');
      if (norm === fieldPath) return err.message;
      if (norm.startsWith(`${fieldPath}/`)) return err.message;
    }
    return undefined;
  });
}
