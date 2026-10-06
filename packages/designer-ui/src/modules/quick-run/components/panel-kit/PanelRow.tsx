import type { KeyboardEvent, ReactNode } from 'react';

export interface PanelRowProps {
  /** Icon / status dot before the text. */
  leading?: ReactNode;
  title: ReactNode;
  /** Muted second line. */
  subtitle?: ReactNode;
  /** Right-aligned meta (time, duration). */
  trailing?: ReactNode;
  /** Makes the row a button (Enter / Space / click). */
  onActivate?: () => void;
  /** Accessible name when the row is interactive. */
  ariaLabel?: string;
  /** Extra content under the subtitle (e.g. an error line). */
  children?: ReactNode;
  className?: string;
}

/**
 * The one-row-two-lines list item of the Quick Run side panels: primary text,
 * a muted secondary line, meta on the right, and the details behind a click.
 */
export function PanelRow({ leading, title, subtitle, trailing, onActivate, ariaLabel, children, className }: PanelRowProps) {
  const interactive = !!onActivate;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onActivate) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  };
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      className={`flex items-start gap-2 rounded px-1.5 py-1 text-[11px] ${
        interactive
          ? 'cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)]'
          : ''
      } ${className ?? ''}`}
    >
      {leading && <span className="mt-[1px] flex shrink-0 items-center">{leading}</span>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[var(--vscode-foreground)]">{title}</div>
        {subtitle && <div className="truncate text-[10px] text-[var(--vscode-descriptionForeground)]">{subtitle}</div>}
        {children}
      </div>
      {trailing && (
        <div className="shrink-0 text-right text-[10px] tabular-nums text-[var(--vscode-descriptionForeground)]">
          {trailing}
        </div>
      )}
    </div>
  );
}
