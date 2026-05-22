import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../ui/Tabs';
import { type JsonPointer } from '../../../model/jsonPointer';
import { DetailPanelHeader } from './DetailPanelHeader';
import { CompositionTab } from './tabs/CompositionTab';
import { ConstraintsTab } from './tabs/ConstraintsTab';
import { GeneralTab } from './tabs/GeneralTab';
import { VNextTab } from './tabs/VNextTab';

type DetailTab = 'general' | 'constraints' | 'composition' | 'vnext';

interface DetailPanelProps {
  pointer: JsonPointer;
}

/**
 * Right pane of the schema tree editor. Hosts the tab strip and renders the
 * editor for the node addressed by `pointer`. Tabs:
 * `General | Constraints | Composition | vNext (x-*)`.
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
          <TabsTrigger value="vnext" variant="default" className="px-2 py-1 text-[10px]">
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
          <VNextTab pointer={pointer} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
