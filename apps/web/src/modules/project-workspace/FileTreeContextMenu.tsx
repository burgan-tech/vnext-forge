import { forwardRef } from 'react';
import { createPortal } from 'react-dom';

export interface FileTreeMenuItem {
  label?: string;
  action?: () => void;
  danger?: boolean;
  accent?: boolean;
  divider?: boolean;
}

export const FileTreeContextMenu = forwardRef<
  HTMLDivElement,
  { x: number; y: number; items: FileTreeMenuItem[] }
>(({ x, y, items }, ref) => {
  /**
   * Portal: sidebar `<aside>` uses `backdrop-blur` + `overflow-y-auto`, which
   * creates a containing block and clips `position: fixed` descendants. Rendering
   * at `document.body` keeps the menu visible when it extends past the sidebar.
   */
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={ref}
      className="animate-scale-in border-primary-border bg-background/95 fixed z-200 min-w-[160px] rounded-xl border py-1.5 shadow-xl backdrop-blur-xl"
      style={{ left: x, top: y }}>
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="border-border-subtle my-1 border-t" />
        ) : (
          <button
            key={i}
            onClick={item.action}
            className={`w-full cursor-pointer px-3 py-1.5 text-left text-xs transition-colors ${
              item.danger
                ? 'text-destructive-text hover:bg-destructive-surface'
                : item.accent
                  ? 'text-tertiary-text hover:bg-tertiary-surface font-semibold'
                  : 'text-foreground hover:bg-primary-hover'
            }`}>
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
});
