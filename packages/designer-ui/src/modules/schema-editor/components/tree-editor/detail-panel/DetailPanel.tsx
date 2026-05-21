import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/Tabs';
import { type JsonPointer } from '../../../model/jsonPointer';
import { DetailPanelHeader } from './DetailPanelHeader';
import { CompositionTab } from './tabs/CompositionTab';
import { ConstraintsTab } from './tabs/ConstraintsTab';
import { GeneralTab } from './tabs/GeneralTab';

type DetailTab = 'general' | 'constraints' | 'composition' | 'vnext';

interface DetailPanelProps {
  pointer: JsonPointer;
}

/**
 * Right pane of the schema tree editor. Hosts the tab strip and renders the
 * editor for the node addressed by `pointer`. Phase 2 only implements the
 * General tab; later phases add Constraints (3), Composition (4), and
 * vNext (5).
 */
export function DetailPanel({ pointer }: DetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('general');

  return (
    <div className="flex h-full flex-col">
      <DetailPanelHeader pointer={pointer} />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as DetailTab)}
        className="flex flex-1 flex-col">
        <TabsList variant="default" className="mx-3 mt-2 h-8 w-fit gap-1 p-1">
          <TabsTrigger value="general" variant="default" className="px-2 py-1 text-[10px]">
            General
          </TabsTrigger>
          <TabsTrigger value="constraints" variant="default" className="px-2 py-1 text-[10px]">
            Constraints
          </TabsTrigger>
          <TabsTrigger value="composition" variant="default" className="px-2 py-1 text-[10px]">
            Composition
          </TabsTrigger>
          <TabsTrigger value="vnext" variant="default" className="px-2 py-1 text-[10px]" disabled>
            vNext (x-*)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex-1 overflow-y-auto p-3">
          <GeneralTab pointer={pointer} />
        </TabsContent>
        <TabsContent value="constraints" className="flex-1 overflow-y-auto p-3">
          <ConstraintsTab pointer={pointer} />
        </TabsContent>
        <TabsContent value="composition" className="flex-1 overflow-y-auto p-3">
          <CompositionTab pointer={pointer} />
        </TabsContent>
        <TabsContent value="vnext" className="flex-1 overflow-y-auto p-3">
          <PhasePlaceholder phase={5} name="vNext extensions" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PhasePlaceholder({ phase, name }: { phase: number; name: string }) {
  return (
    <div className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/40 p-4 text-center text-[11px] text-primary-text/65">
      {name} editor arrives in Phase {phase}. The values still load and save without loss in the
      meantime.
    </div>
  );
}
