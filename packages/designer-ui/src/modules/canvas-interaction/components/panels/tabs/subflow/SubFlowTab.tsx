import { useCallback } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import type { SubFlowOverrides } from '@vnext-forge/vnext-types';
import { useWorkflowStore } from '../../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../../store/useProjectStore';
import type { ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { SubFlowProcessRefSection } from './SubFlowProcessRefSection';
import { SubFlowMappingSection } from './SubFlowMappingSection';
import { SubFlowOverridesSection } from './SubFlowOverridesSection';
import { GitBranch } from 'lucide-react';

interface SubFlowTabProps {
  state: any;
}

export function SubFlowTab({ state }: SubFlowTabProps) {
  const { updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);

  const stateKey: string = state.key;
  const sf = state.subFlow;
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);

  const findState = useCallback(
    (draft: any) => draft.attributes?.states?.find((s: any) => s.key === stateKey),
    [stateKey],
  );

  const addSubFlow = useCallback(
    (component?: DiscoveredVnextComponent) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s) return;
        s.subFlow = {
          type: 'S',
          process: {
            key: component?.key ?? '',
            domain: component ? projectDomain : '',
            version: component?.version ?? '1.0.0',
            flow: component?.flow ?? 'sys-flows',
          },
        };
      });
    },
    [updateWorkflow, findState, projectDomain],
  );

  const removeSubFlow = useCallback(() => {
    updateWorkflow((draft: any) => {
      const s = findState(draft);
      if (!s) return;
      delete s.subFlow;
    });
  }, [updateWorkflow, findState]);

  const updateProcessField = useCallback(
    (field: string, value: string) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s?.subFlow) return;
        if (!s.subFlow.process) s.subFlow.process = { key: '', domain: '', version: '', flow: '' };
        s.subFlow.process[field] = value;
      });
    },
    [updateWorkflow, findState],
  );

  const handleSelectWorkflow = useCallback(
    (component: DiscoveredVnextComponent) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s) return;
        if (!s.subFlow) {
          s.subFlow = { type: 'S', process: { key: '', domain: '', version: '', flow: '' } };
        }
        s.subFlow.process = {
          key: component.key,
          domain: projectDomain,
          version: component.version || '1.0.0',
          flow: component.flow || 'sys-flows',
        };
      });
    },
    [updateWorkflow, findState, projectDomain],
  );

  const updateMapping = useCallback(
    (mapping: ScriptCode) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s?.subFlow) return;
        s.subFlow.mapping = mapping;
      });
    },
    [updateWorkflow, findState],
  );

  const removeMapping = useCallback(() => {
    updateWorkflow((draft: any) => {
      const s = findState(draft);
      if (!s?.subFlow) return;
      delete s.subFlow.mapping;
    });
  }, [updateWorkflow, findState]);

  const updateOverrides = useCallback(
    (updater: (overrides: SubFlowOverrides) => void) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s?.subFlow) return;
        if (!s.subFlow.overrides) s.subFlow.overrides = {};
        updater(s.subFlow.overrides);
      });
    },
    [updateWorkflow, findState],
  );

  if (!sf) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-3">
        <div className="bg-muted text-muted-foreground mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
          <GitBranch size={22} />
        </div>
        <div className="text-[12px] font-semibold text-muted-foreground mb-1">No SubFlow configured</div>
        <div className="text-[10px] text-subtle text-center mb-3 leading-relaxed max-w-[240px]">
          Reference another workflow and optional mapping or security overrides.
        </div>
        <button
          type="button"
          onClick={() => addSubFlow()}
          className="text-[11px] font-semibold text-secondary-icon hover:text-secondary-foreground bg-secondary-surface hover:bg-secondary-muted border border-secondary-border rounded-lg px-3 py-1.5 cursor-pointer transition-colors">
          Add SubFlow
        </button>
      </div>
    );
  }

  const process = sf.process ?? { key: sf.key ?? '', domain: sf.domain ?? '', version: sf.version ?? '', flow: sf.flow ?? '' };

  return (
    <div className="space-y-3">
      <SubFlowProcessRefSection
        process={process}
        projectDomain={projectDomain}
        onUpdateField={updateProcessField}
        onSelectWorkflow={handleSelectWorkflow}
        onRemove={removeSubFlow}
        canPickExisting={canPickExisting}
      />

      <SubFlowMappingSection
        mapping={sf.mapping}
        stateKey={stateKey}
        onChange={updateMapping}
        onRemove={removeMapping}
      />

      <SubFlowOverridesSection
        overrides={sf.overrides}
        onUpdateOverrides={updateOverrides}
      />
    </div>
  );
}
