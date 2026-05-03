import { useState, useCallback } from 'react';
import type { RoleGrant, ViewBinding } from '@vnext-forge/vnext-types';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import { getLabels } from './PropertyPanelHelpers';
import { SelectField, Section, InfoRow, SummaryCard } from './PropertyPanelShared';
import { RoleGrantEditor } from './subflow/RoleGrantEditor';
import { ViewBindingsSection } from './shared/ViewBindingsSection';
import { ChooseExistingVnextComponentDialog } from './ChooseExistingTaskDialog';
import { CreateNewComponentDialog } from './CreateNewComponentDialog';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../store/useProjectStore';
import { Trash2, Plus } from 'lucide-react';

interface GeneralTabProps {
  state: any;
  updateWorkflow: any;
}

export function GeneralTab({ state, updateWorkflow }: GeneralTabProps) {
  const labels = getLabels(state);
  const stateKey = state.key;
  const queryRoles: RoleGrant[] = state.queryRoles ?? [];

  const activeProject = useProjectStore((s) => s.activeProject);
  const projectDomain = activeProject?.domain ?? '';

  const [viewPickerBindingIndex, setViewPickerBindingIndex] = useState<number | null | undefined>(undefined);
  const [viewCreatorBindingIndex, setViewCreatorBindingIndex] = useState<number | null | undefined>(undefined);
  const [extensionPickerBindingIndex, setExtensionPickerBindingIndex] = useState<number | null | undefined>(undefined);

  const viewPickerOpen = viewPickerBindingIndex !== undefined;
  const viewCreatorOpen = viewCreatorBindingIndex !== undefined;
  const extensionPickerOpen = extensionPickerBindingIndex !== undefined;

  const updateField = (field: string, value: any) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (s) s[field] = value;
    });
  };

  const updateQueryRoles = useCallback((roles: RoleGrant[]) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (s) s.queryRoles = roles.length > 0 ? roles : undefined;
    });
  }, [updateWorkflow, stateKey]);

  const updateStateView = useCallback((view: ViewBinding | null) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (view) {
        s.view = view;
        delete s.views;
      } else {
        delete s.view;
      }
    });
  }, [updateWorkflow, stateKey]);

  const updateStateViews = useCallback((views: ViewBinding[]) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (views.length > 0) {
        s.views = views;
        delete s.view;
      } else {
        delete s.views;
      }
    });
  }, [updateWorkflow, stateKey]);

  const handleViewPickerSelect = useCallback((component: DiscoveredVnextComponent) => {
    const ref = {
      key: component.key,
      domain: projectDomain,
      version: component.version || '1.0.0',
      flow: component.flow || 'sys-views',
    };
    const bindingIndex = viewPickerBindingIndex;
    if (bindingIndex != null) {
      updateWorkflow((draft: any) => {
        const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
        if (!s?.views?.[bindingIndex]) return;
        s.views[bindingIndex].view = ref;
      });
    } else {
      updateStateView({ view: ref, loadData: false });
    }
  }, [viewPickerBindingIndex, projectDomain, updateWorkflow, stateKey, updateStateView]);

  const handleViewCreated = useCallback((created: DiscoveredVnextComponent) => {
    const ref = {
      key: created.key,
      domain: projectDomain,
      version: created.version || '1.0.0',
      flow: created.flow || 'sys-views',
    };
    const bindingIndex = viewCreatorBindingIndex;
    if (bindingIndex != null) {
      updateWorkflow((draft: any) => {
        const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
        if (!s?.views?.[bindingIndex]) return;
        s.views[bindingIndex].view = ref;
      });
    } else {
      updateStateView({ view: ref, loadData: false });
    }
  }, [viewCreatorBindingIndex, projectDomain, updateWorkflow, stateKey, updateStateView]);

  const handleExtensionPickerSelect = useCallback((component: DiscoveredVnextComponent) => {
    const bindingIndex = extensionPickerBindingIndex;
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (bindingIndex != null) {
        const binding = s.views?.[bindingIndex];
        if (!binding) return;
        if (!binding.extensions) binding.extensions = [];
        if (!binding.extensions.includes(component.key)) {
          binding.extensions.push(component.key);
        }
      } else {
        if (!s.view) return;
        if (!s.view.extensions) s.view.extensions = [];
        if (!s.view.extensions.includes(component.key)) {
          s.view.extensions.push(component.key);
        }
      }
    });
  }, [extensionPickerBindingIndex, updateWorkflow, stateKey]);

  const updateLabel = (index: number, text: string) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      const lbls = s.labels || s.label;
      if (lbls?.[index]) lbls[index].label = text;
    });
  };

  const addLabel = () => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (!s.labels) s.labels = [];
      s.labels.push({ label: '', language: 'en' });
    });
  };

  const removeLabel = (index: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      const lbls = s.labels || s.label;
      if (lbls) lbls.splice(index, 1);
    });
  };

  const canPickExisting = Boolean(activeProject);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">Key</label>
        <InfoRow label="" value={state.key} mono copyable />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">State Type</label>
        <SelectField
          value={state.stateType || 2}
          onChange={(v) => {
            const val = Number(v);
            updateField('stateType', val);
            if (val !== 3) updateField('subType', undefined);
          }}
          options={[
            { value: 1, label: 'Initial' }, { value: 2, label: 'Intermediate' },
            { value: 3, label: 'Final' }, { value: 4, label: 'SubFlow' }, { value: 5, label: 'Wizard' },
          ]}
        />
      </div>

      {(state.stateType === 3) && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">Sub Type</label>
          <SelectField
            value={state.subType || 0}
            onChange={(v) => updateField('subType', Number(v))}
            options={[
              { value: 0, label: 'None' }, { value: 1, label: 'Success' }, { value: 2, label: 'Error' },
              { value: 3, label: 'Terminated' }, { value: 4, label: 'Suspended' },
              { value: 5, label: 'Busy' }, { value: 6, label: 'Human' },
            ]}
          />
        </div>
      )}

      <div>
        <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">Description</label>
        <textarea
          value={state._comment ?? ''}
          onChange={(e) => updateField('_comment', e.target.value || undefined)}
          placeholder="State description..."
          rows={2}
          aria-label="State description"
          className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all resize-y"
        />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground block mb-1 font-semibold tracking-wide">Version Strategy</label>
        <SelectField
          value={state.versionStrategy || 'Minor'}
          onChange={(v) => updateField('versionStrategy', v)}
          options={[
            { value: 'Minor', label: 'Minor' }, { value: 'Major', label: 'Major' }, { value: 'Patch', label: 'Patch' },
          ]}
        />
      </div>

      {/* Query Roles */}
      <Section title="Query Roles" count={queryRoles.length} defaultOpen={queryRoles.length > 0}>
        <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
          Control which roles can query this state.
        </p>
        <RoleGrantEditor
          roles={queryRoles}
          onChange={updateQueryRoles}
          contextLabel="state"
        />
      </Section>

      {/* Views */}
      <ViewBindingsSection
        view={state.view ?? null}
        views={state.views ?? []}
        onUpdateView={updateStateView}
        onUpdateViews={updateStateViews}
        onBrowseView={(bindingIndex) => setViewPickerBindingIndex(bindingIndex)}
        onCreateView={(bindingIndex) => setViewCreatorBindingIndex(bindingIndex)}
        onBrowseExtension={(bindingIndex) => setExtensionPickerBindingIndex(bindingIndex)}
        canPickExisting={canPickExisting}
        contextId={stateKey}
        scriptFieldPrefix="views"
        stateKey={stateKey}
        description="Assign a view to this state. Use rule-based mode for conditional view selection."
      />

      <Section title="Labels" count={labels.length} defaultOpen>
        <div className="space-y-2">
          {labels.map((l: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={l.language}
                onChange={(e) => {
                  updateWorkflow((draft: any) => {
                    const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
                    const lbls = s?.labels || s?.label;
                    if (lbls?.[i]) lbls[i].language = e.target.value;
                  });
                }}
                className="w-10 px-2 py-1.5 text-[11px] font-mono text-muted-foreground border border-border rounded-lg bg-muted text-center shrink-0 focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <input
                type="text"
                value={l.label}
                onChange={(e) => updateLabel(i, e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all"
              />
              <button onClick={() => removeLabel(i)} className="p-1 text-subtle hover:text-destructive-text hover:bg-destructive-surface rounded-lg transition-all cursor-pointer">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={addLabel} className="flex items-center gap-1.5 text-[11px] text-secondary-icon hover:text-secondary-foreground font-semibold mt-1 cursor-pointer">
            <Plus size={13} /> Add Label
          </button>
        </div>
      </Section>

      {/* Quick summary */}
      <div className="mt-3 pt-3 border-t border-border-subtle">
        <div className="text-[9px] font-bold text-muted-foreground mb-2 tracking-widest uppercase">Summary</div>
        <div className="grid grid-cols-3 gap-1.5">
          <SummaryCard label="Entry Tasks" value={state.onEntries?.length || 0} color="text-intermediate bg-intermediate/10" />
          <SummaryCard label="Exit Tasks" value={state.onExits?.length || 0} color="text-subflow bg-subflow/10" />
          <SummaryCard label="Transitions" value={state.transitions?.length || 0} color="text-initial bg-initial/10" />
        </div>
      </div>

      {/* View picker/creator dialogs */}
      <ChooseExistingVnextComponentDialog
        open={viewPickerOpen}
        onOpenChange={(open) => { if (!open) setViewPickerBindingIndex(undefined); }}
        category="views"
        onSelect={handleViewPickerSelect}
      />
      <CreateNewComponentDialog
        open={viewCreatorOpen}
        onOpenChange={(open) => { if (!open) setViewCreatorBindingIndex(undefined); }}
        category="views"
        onCreated={handleViewCreated}
      />
      <ChooseExistingVnextComponentDialog
        open={extensionPickerOpen}
        onOpenChange={(open) => { if (!open) setExtensionPickerBindingIndex(undefined); }}
        category="extensions"
        onSelect={handleExtensionPickerSelect}
      />
    </div>
  );
}
