import { memo, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Floating overlay listing every canvas keyboard shortcut.
 * Mounted from the FlowCanvas at the document body level so it
 * floats above all canvas chrome. Closed by Escape or by
 * clicking outside.
 *
 * Lists are static (defined here) — kept in sync by code review,
 * not by introspecting the actual handler registrations. The
 * total set is small enough (~12 shortcuts) that drift is easy
 * to catch.
 */
interface ShortcutEntry {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    entries: [
      { keys: ['Tab'], label: 'Next state' },
      { keys: ['Shift', 'Tab'], label: 'Previous state' },
      { keys: ['Enter'], label: 'Open inspector on selected state' },
      { keys: ['⌘', 'F'], label: 'Search states & transitions' },
      { keys: ['?'], label: 'Open this shortcuts overlay' },
      { keys: ['Esc'], label: 'Close overlays / exit presentation' },
    ],
  },
  {
    title: 'Editing',
    entries: [
      { keys: ['Backspace'], label: 'Delete selected state(s) / edge(s)' },
      { keys: ['Delete'], label: 'Delete selected state(s) / edge(s)' },
      { keys: ['⌘', 'Z'], label: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], label: 'Redo' },
      { keys: ['⌘', 'S'], label: 'Save workflow' },
      { keys: ['Dbl-click empty canvas'], label: 'Drop a sticky note' },
    ],
  },
  {
    title: 'Selection',
    entries: [
      { keys: ['Shift', 'Click'], label: 'Add node to selection' },
      { keys: ['Drag rect.'], label: 'Multi-select (in Select Box mode)' },
    ],
  },
  {
    title: 'Canvas',
    entries: [
      { keys: ['Scroll'], label: 'Zoom in/out' },
      { keys: ['Drag empty'], label: 'Pan (in Pan mode) / Select (in Select Box mode)' },
      { keys: ['Middle / Right drag'], label: 'Pan (in Select Box mode)' },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsDialog = memo(function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-[640px] overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-foreground">
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close keyboard shortcuts overlay"
          >
            <X size={14} />
          </button>
        </header>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.entries.map((entry) => (
                  <li
                    key={entry.label}
                    className="flex items-center justify-between gap-3 text-[12px] text-foreground"
                  >
                    <span className="truncate">{entry.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {entry.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <footer className="border-t border-border px-5 py-2 text-[10px] text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">Esc</kbd> or click outside to close.
        </footer>
      </div>
    </div>
  );
});
