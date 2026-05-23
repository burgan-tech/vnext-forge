/**
 * Draggable palette of pseudo-ui components.
 *
 * Categorized accordion with a search input. Each card is a `@dnd-kit`
 * draggable source whose `data.kind === 'palette'`. The canvas listens
 * for drops and inserts a fresh node via `createNodeFromCatalog(type)`.
 */

import { useDraggable } from '@dnd-kit/core';
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

export function ComponentPalette({ className, onAdd }: ComponentPaletteProps) {
  const [query, setQuery] = useState('');

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

  return (
    <div className={`flex h-full min-h-0 flex-col ${className ?? ''}`}>
      <div className="border-b border-[var(--vscode-panel-border)] p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components..."
          aria-label="Search components"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {grouped.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-[var(--vscode-descriptionForeground)]">
            No components match "{query}".
          </p>
        ) : (
          grouped.map(({ category, items }) => (
            <section key={category} className="mb-3">
              <h3 className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                {category}
              </h3>
              <div className="grid grid-cols-2 gap-1">
                {items.map((meta) => (
                  <PaletteCard key={meta.type} meta={meta} onAdd={onAdd} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

interface PaletteCardProps {
  meta: ComponentMeta;
  onAdd?: (type: string) => void;
}

function PaletteCard({ meta, onAdd }: PaletteCardProps) {
  const id = `palette-${meta.type}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { kind: 'palette', type: meta.type } as const,
  });

  const Icon = resolveLucideIcon(meta.iconName);

  return (
    <div
      ref={setNodeRef}
      title={meta.description ?? meta.label}
      className={[
        'group relative flex flex-col items-start gap-1 rounded border px-2 py-1.5 text-left transition-colors',
        'border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)]',
        'hover:border-[var(--vscode-focusBorder)] hover:bg-[var(--vscode-list-hoverBackground)]',
        isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab',
      ].join(' ')}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-1.5 pr-5">
        <Icon size={13} aria-hidden />
        <span className="text-[11px] font-medium">{meta.label}</span>
      </div>
      {meta.description ? (
        <span className="line-clamp-1 pr-5 text-[10px] text-[var(--vscode-descriptionForeground)]">
          {meta.description}
        </span>
      ) : null}
      {onAdd ? (
        <button
          type="button"
          aria-label={`Add ${meta.label} to selection`}
          // Stop pointerdown so dnd-kit doesn't treat the click as a drag start.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(meta.type);
          }}
          className={[
            'absolute right-1 top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded',
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
