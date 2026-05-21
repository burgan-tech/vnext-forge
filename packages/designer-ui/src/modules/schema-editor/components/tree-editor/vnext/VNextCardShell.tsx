import { type ReactNode, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Checkbox } from '../../../../../ui/Checkbox';
import { cn } from '../../../../../lib/utils/cn';
import { VNextHelpLink } from './VNextHelpLink';

interface VNextCardShellProps {
  /** vNext keyword managed by this card (e.g. `x-labels`). */
  xKey: string;
  /** Friendly title shown in the header. */
  title: string;
  /** Single sentence describing what the keyword does. */
  purpose: string;
  /** Optional documentation URL — when present, a "?" link is rendered. */
  docHref?: string;
  /** Whether the keyword is currently set on the node. */
  enabled: boolean;
  /** Toggle handler — disabling deletes the keyword from the node. */
  onToggle: (next: boolean) => void;
  /** Body editor content; only rendered when `enabled` is true. */
  children: ReactNode;
  /** Optional inline validation message rendered under the body. */
  error?: ReactNode;
  /** Disables the toggle (e.g. when the keyword cannot apply to the node). */
  toggleDisabled?: boolean;
  /** Reason shown to the user when the toggle is disabled. */
  toggleDisabledReason?: string;
}

/**
 * Unified card shell used by every `x-*` editor. Provides a consistent
 * layout (collapsible header with title + purpose + help + enable toggle,
 * body slot, error footer) so the vNext tab feels uniform across cards.
 *
 * Disabling the toggle deletes the keyword entirely; enabling it relies
 * on the parent card to seed a default value via `useVNextEnabled`.
 */
export function VNextCardShell({
  xKey,
  title,
  purpose,
  docHref,
  enabled,
  onToggle,
  children,
  error,
  toggleDisabled = false,
  toggleDisabledReason,
}: VNextCardShellProps) {
  const [expanded, setExpanded] = useState(enabled);
  const showBody = enabled && expanded;
  const toggleId = `vnext-toggle-${xKey}`;

  return (
    <section
      className={cn(
        'rounded-md border bg-primary-muted/20 transition-colors',
        enabled ? 'border-primary-border' : 'border-primary-border/40 opacity-90',
      )}
      aria-label={`${xKey} editor`}>
      <header className="flex flex-wrap items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          disabled={!enabled}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={enabled && expanded}
          className={cn(
            'mt-0.5 grid size-4 place-items-center rounded text-primary-text/55',
            enabled && 'hover:text-primary-text',
            !enabled && 'opacity-40',
          )}>
          {showBody ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] text-primary-text/55">{xKey}</p>
            <h3 className="text-xs font-semibold">{title}</h3>
            {docHref ? <VNextHelpLink href={docHref} /> : null}
          </div>
          <p className="mt-0.5 text-[10px] text-primary-text/65">{purpose}</p>
        </div>

        <div
          className="flex items-center gap-2"
          title={toggleDisabled ? toggleDisabledReason : undefined}>
          <label htmlFor={toggleId} className="text-[10px] text-primary-text/65">
            {enabled ? 'Enabled' : 'Disabled'}
          </label>
          <Checkbox
            id={toggleId}
            checked={enabled}
            disabled={toggleDisabled}
            onCheckedChange={(value) => onToggle(value === true)}
          />
        </div>
      </header>

      {showBody ? (
        <div className="space-y-3 border-t border-primary-border/40 px-3 py-3">{children}</div>
      ) : null}

      {error ? (
        <p className="border-t border-destructive-border/40 bg-destructive-muted/30 px-3 py-1.5 text-[10px] text-destructive-text">
          {error}
        </p>
      ) : null}
    </section>
  );
}
