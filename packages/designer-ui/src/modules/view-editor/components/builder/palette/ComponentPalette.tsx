/**
 * Draggable palette of pseudo-ui components.
 *
 * R11: cards are HTML5-native draggables. On `dragstart` we set
 * `application/x-pseudo-ui-palette` on the dataTransfer; the SDK's
 * designer-mode wrappers around each canvas node listen for that
 * MIME type and dispatch `delegate.onNodeDropFromPalette` with the
 * resolved drop position. The canvas does not register any droppable
 * of its own — drag-drop is handled entirely by the SDK render tree.
 *
 * Outline-tree drag-drop continues to use `@dnd-kit` for in-tree
 * reordering (separate render context, no conflict). Palette → outline
 * drops are intentionally not supported; the canvas is the primary
 * insertion surface for the palette.
 *
 * R12.1: categories are now collapsible accordions so the palette is
 * compact by default and scrolling a single panel to find a component
 * is rarely needed. The first two groups (Layout, Container) are
 * expanded on first render; the rest start collapsed. Searching
 * force-expands every group with matches so the user always sees
 * results without having to expand each section manually.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '../../../../../ui/Input';
import { COMPONENT_CATALOG, listCategories } from './componentCatalog';
import type { ComponentMeta } from '../types';

export interface ComponentPaletteProps {
  className?: string;
  /** Click-to-add handler — when omitted, the "+" affordance is hidden and
   * only drag-drop is available. */
  onAdd?: (type: string) => void;
}

/** Categories that start expanded on first render. Other categories
 *  begin collapsed; user clicks to expand. Searching force-expands
 *  every category with matches regardless of this default. */
const DEFAULT_EXPANDED: ReadonlySet<string> = new Set(['Layout', 'Container']);

export function ComponentPalette({ className, onAdd }: ComponentPaletteProps) {
  const [query, setQuery] = useState('');
  // Tracks which categories the user has manually toggled. Categories
  // not in this map fall back to `DEFAULT_EXPANDED` (or force-open
  // when search is active). Letting the search override the manual
  // toggle is intentional — the user is looking for *something* and
  // collapsed sections would hide matches.
  const [userToggled, setUserToggled] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const categories = listCategories();
    return categories
      .map((cat) => {
        const items = COMPONENT_CATALOG.filter(
          (c) =>
            c.category === cat &&
            (q === '' ||
              c.label.toLowerCase().includes(q) ||
              c.type.toLowerCase().includes(q) ||
              c.description?.toLowerCase().includes(q)),
        );
        return { category: cat, items };
      })
      .filter((g) => g.items.length > 0);
  }, [query]);

  const searchActive = query.trim() !== '';

  const isExpanded = (category: string): boolean => {
    if (searchActive) return true;
    if (category in userToggled) return userToggled[category]!;
    return DEFAULT_EXPANDED.has(category);
  };

  const toggle = (category: string): void => {
    setUserToggled((prev) => ({
      ...prev,
      [category]: !isExpanded(category),
    }));
  };

  return (
    <div className={`flex h-full min-h-0 flex-col ${className ?? ''}`}>
      <div className="border-b border-[var(--vscode-panel-border)] p-2">
        <Input
          size="sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components..."
          aria-label="Search components"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {grouped.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-[var(--vscode-descriptionForeground)]">
            No components match "{query}".
          </p>
        ) : (
          grouped.map(({ category, items }) => {
            const expanded = isExpanded(category);
            return (
              <section key={category} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggle(category)}
                  className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
                  aria-expanded={expanded}
                  aria-controls={`palette-section-${category}`}
                >
                  {expanded ? <ChevronDown size={11} aria-hidden /> : <ChevronRight size={11} aria-hidden />}
                  <span>{category}</span>
                  <span className="ml-auto text-[var(--vscode-descriptionForeground)]">{items.length}</span>
                </button>
                {expanded ? (
                  <div
                    id={`palette-section-${category}`}
                    className="grid grid-cols-2 gap-1 px-1 pb-2 pt-1"
                  >
                    {items.map((meta) => (
                      <PaletteCard key={meta.type} meta={meta} onAdd={onAdd} />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

interface PaletteCardProps {
  meta: ComponentMeta;
  onAdd?: (type: string) => void;
}

/**
 * dataTransfer MIME the SDK's `DesignerNode` reads on drop. Must
 * match the literal in `core/ts-pseudo-ui/src/adapters/react/DesignerNode.tsx`.
 */
const DRAG_PALETTE_MIME = 'application/x-pseudo-ui-palette';

function PaletteCard({ meta, onAdd }: PaletteCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>): void => {
    e.dataTransfer.setData(DRAG_PALETTE_MIME, meta.type);
    e.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
  };

  const handleDragEnd = (): void => {
    setIsDragging(false);
  };

  const Icon = resolveLucideIcon(meta.iconName);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={meta.description ?? meta.label}
      className={[
        'group relative flex items-center gap-1.5 rounded border px-1.5 py-1 text-left transition-colors',
        'border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)]',
        'hover:border-[var(--vscode-focusBorder)] hover:bg-[var(--vscode-list-hoverBackground)]',
        isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab',
      ].join(' ')}
    >
      <Icon size={13} aria-hidden />
      <span className="truncate text-[11px] font-medium">{meta.label}</span>
      {onAdd ? (
        <button
          type="button"
          aria-label={`Add ${meta.label} to selection`}
          // Suppress the implicit drag the parent would otherwise start
          // when the user click-drags the "+" button itself.
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(meta.type);
          }}
          className={[
            'ml-auto flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded',
            'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
            'text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-activeSelectionBackground)] hover:text-[var(--vscode-list-activeSelectionForeground)]',
          ].join(' ')}
        >
          <Plus size={11} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Look up a lucide-react icon by name with a sensible fallback. */
function resolveLucideIcon(name: string): React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> {
  const candidate = (Icons as unknown as Record<string, unknown>)[name];
  if (typeof candidate === 'function' || typeof candidate === 'object') {
    return candidate as React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  }
  return Icons.Square as React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
}
