/**
 * Tabbed left rail — switches between the outline (default) and the
 * component palette. This is the Figma / Webflow / Builder.io pattern:
 *
 *   - Outline is the primary structural editing surface (most-used).
 *   - Palette is one click away when adding new components.
 *
 * Keeping them in the same column frees the center for a full-height
 * canvas and keeps inspector ↔ outline visually adjacent across the
 * shell width (left-click outline → right-side inspector updates).
 */

import { Boxes, ListTree } from 'lucide-react';
import { useCallback } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/Tabs';
import { ComponentPalette } from './palette/ComponentPalette';
import { OutlinePanel } from './tree/OutlinePanel';
import { createNodeFromCatalog } from './palette/componentCatalog';
import { pickSmartInsertTarget } from './utils/nodeOps';
import { type BuilderStore } from './state/builderStore';

export interface LeftRailProps {
  store: BuilderStore;
  defaultTab?: 'outline' | 'components';
}

export function LeftRail({ store, defaultTab = 'outline' }: LeftRailProps) {
  // Click-to-add from the palette. Picks a smart insertion target (selected
  // container > leaf parent > root) and inserts a fresh node from the catalog
  // defaults. Selection follows the new node so the inspector immediately
  // shows its properties.
  const handleAdd = useCallback(
    (type: string) => {
      const state = store.getState();
      const target = pickSmartInsertTarget(state.definition.view, state.selectedPath);
      if (!target) return;
      const fresh = createNodeFromCatalog(type);
      state.insertNode(target.parentPath, target.index, fresh);
      state.selectNode([...target.parentPath, target.index]);
    },
    [store],
  );

  return (
    <Tabs defaultValue={defaultTab} className="flex h-full min-h-0 flex-col">
      <TabsList className="shrink-0 grid grid-cols-2 rounded-none border-b border-[var(--vscode-panel-border)] bg-transparent p-0">
        <TabsTrigger value="outline" className="flex items-center gap-1.5 rounded-none text-[11px]">
          <ListTree size={12} aria-hidden /> Outline
        </TabsTrigger>
        <TabsTrigger value="components" className="flex items-center gap-1.5 rounded-none text-[11px]">
          <Boxes size={12} aria-hidden /> Components
        </TabsTrigger>
      </TabsList>
      <TabsContent value="outline" className="min-h-0 flex-1">
        <OutlinePanel store={store} />
      </TabsContent>
      <TabsContent value="components" className="min-h-0 flex-1">
        <ComponentPalette onAdd={handleAdd} />
      </TabsContent>
    </Tabs>
  );
}
