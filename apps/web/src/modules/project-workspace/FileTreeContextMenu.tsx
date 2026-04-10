import { forwardRef } from 'react';

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
  return (
    <div
      ref={ref}
      className="animate-scale-in border-primary-border bg-background/95 fixed z-50 min-w-[160px] rounded-xl border py-1.5 shadow-xl backdrop-blur-xl"
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
    </div>
  );
});
