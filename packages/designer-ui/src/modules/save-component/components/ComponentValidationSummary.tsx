import { useState, useEffect, useRef } from 'react';
import { useComponentStore } from '../../../store/useComponentStore';

/**
 * Persistent, collapsible panel that shows all validation errors from
 * `useComponentStore.validationErrors`. Renders only when errors exist.
 * The toast "View issues" action scrolls/focuses this element via its id.
 */
export function ComponentValidationSummary() {
  const errors = useComponentStore((s) => s.validationErrors);
  const [collapsed, setCollapsed] = useState(false);
  const headingRef = useRef<HTMLButtonElement>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (errors.length > 0 && prevCountRef.current === 0) {
      setCollapsed(false);
      requestAnimationFrame(() => headingRef.current?.focus());
    }
    prevCountRef.current = errors.length;
  }, [errors.length]);

  if (errors.length === 0) return null;

  return (
    <div
      id="component-validation-summary"
      role="region"
      aria-labelledby="component-validation-summary-heading"
      tabIndex={-1}
      className="rounded-md border border-destructive-border bg-destructive-surface"
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {errors.length > 0 ? `Validation failed, ${errors.length} issue${errors.length > 1 ? 's' : ''}` : ''}
      </span>
      <button
        ref={headingRef}
        id="component-validation-summary-heading"
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-destructive-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive-border focus-visible:ring-offset-1 rounded-md"
      >
        <span aria-hidden="true" className="shrink-0 text-[10px]">
          {collapsed ? '▶' : '▼'}
        </span>
        {errors.length} validation issue{errors.length > 1 ? 's' : ''}
      </button>
      {!collapsed && (
        <ul className="max-h-48 overflow-y-auto border-t border-destructive-border px-3 pb-2 pt-1">
          {errors.map((err, i) => (
            <li key={`${err.path}-${i}`} className="flex flex-col gap-0.5 border-b border-destructive-border/30 py-1.5 last:border-b-0">
              {err.path && (
                <span className="font-mono text-[10px] text-destructive-text/70 truncate" title={err.path}>
                  {err.path}
                </span>
              )}
              <span className="text-[11px] text-destructive-text">{err.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
