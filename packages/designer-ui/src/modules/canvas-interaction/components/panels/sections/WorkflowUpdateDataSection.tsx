import { useState, useCallback } from 'react';
import { Plus, Zap } from 'lucide-react';
import type { DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../store/useProjectStore';
import {
  SchemaReferenceField,
  type SchemaReference,
} from '../../../../../modules/save-component/components/SchemaReferenceField';
import { OpenVnextComponentInModalButton } from '../../../../save-component/components/OpenVnextComponentInModalButton';
import { ChooseExistingVnextComponentDialog } from '../tabs/ChooseExistingTaskDialog';
import { CreateNewComponentDialog } from '../tabs/CreateNewComponentDialog';
import { AvailableInMultiSelect } from '../tabs/shared/AvailableInMultiSelect';
import { MetadataSection } from './MetadataSection';
import { useStateOptions } from './useStateOptions';

const inputClass =
  'w-full px-2.5 py-1.5 text-xs font-mono border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle';

export function WorkflowUpdateDataSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [schemaBrowseOpen, setSchemaBrowseOpen] = useState(false);
  const [schemaCreateOpen, setSchemaCreateOpen] = useState(false);

  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const updateData = attrs.updateData;
  const stateOptions = useStateOptions();
  const canPick = Boolean(activeProject && vnextConfig?.paths);

  const createUpdateData = () => {
    updateWorkflow((draft: any) => {
      draft.attributes.updateData = {
        key: 'update-data',
        target: '$self',
        versionStrategy: 'Major',
        triggerType: 0,
        schema: null,
        availableIn: [],
        labels: [{ label: 'Update Data', language: 'en' }],
      };
    });
  };

  const removeUpdateData = () => {
    updateWorkflow((draft: any) => {
      delete draft.attributes.updateData;
    });
  };

  const updateField = (field: string, value: any) => {
    updateWorkflow((draft: any) => {
      if (draft.attributes?.updateData) draft.attributes.updateData[field] = value;
    });
  };

  const handleSchemaChange = useCallback(
    (ref: SchemaReference | null) => {
      updateWorkflow((draft: any) => {
        if (draft.attributes?.updateData) draft.attributes.updateData.schema = ref;
      });
    },
    [updateWorkflow],
  );

  const handleSchemaPicked = useCallback(
    (component: DiscoveredVnextComponent) => {
      const ref: SchemaReference = {
        key: component.key,
        domain: component.domain ?? '',
        version: component.version ?? '1.0.0',
        flow: component.flow || 'sys-schemas',
      };
      handleSchemaChange(ref);
    },
    [handleSchemaChange],
  );

  const schema: SchemaReference | null = updateData?.schema ?? null;
  const hasSchema = schema?.key || schema?.flow;

  return (
    <MetadataSection title="Update Data" icon={<Zap size={13} />} defaultOpen={!!updateData}>
      {updateData ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">
              Update Data Transition
            </span>
            <button
              onClick={removeUpdateData}
              className="text-destructive-text hover:text-destructive-icon cursor-pointer text-[11px] font-semibold">
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold">Key</label>
              <input
                type="text"
                value={updateData.key || ''}
                onChange={(e) => updateField('key', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold">
                Target
              </label>
              <div className="bg-muted text-muted-foreground rounded-lg px-2.5 py-1.5 font-mono text-xs">
                $self
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold">
                Version Strategy
              </label>
              <select
                value={updateData.versionStrategy || 'Major'}
                onChange={(e) => updateField('versionStrategy', e.target.value)}
                className={inputClass + ' cursor-pointer'}>
                <option value="None">None</option>
                <option value="Minor">Minor</option>
                <option value="Major">Major</option>
              </select>
            </div>
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold">
                Trigger Type
              </label>
              <select
                value={updateData.triggerType ?? 0}
                onChange={(e) => updateField('triggerType', Number(e.target.value))}
                className={inputClass + ' cursor-pointer'}>
                <option value={0}>Manual</option>
                <option value={1}>Auto</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-muted-foreground text-[10px] font-semibold mb-1.5 block">
              Schema
            </label>
            <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
              Optional payload schema. Pick from the workspace, create a new one, or enter a reference manually.
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setSchemaBrowseOpen(true)}
                disabled={!canPick}
                className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                title={
                  canPick
                    ? 'Pick a schema from workspace JSON files'
                    : 'Requires an open project and vnext.config.json with paths'
                }>
                Choose Existing
              </button>
              <button
                type="button"
                onClick={() => setSchemaCreateOpen(true)}
                disabled={!canPick}
                className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                title="Create a new schema JSON under Schemas/">
                <Plus size={13} /> Create New
              </button>
            </div>
            {hasSchema && <SchemaReferenceField value={schema} onChange={handleSchemaChange} />}
            {hasSchema && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleSchemaChange(null)}
                  className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors">
                  Clear schema
                </button>
                {schema?.key && schema?.flow && (
                  <OpenVnextComponentInModalButton
                    componentKey={String(schema.key)}
                    flow={String(schema.flow)}
                    title="Open schema JSON in modal editor"
                  />
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-muted-foreground text-[10px] font-semibold">
              Available in states
            </label>
            <AvailableInMultiSelect
              value={updateData.availableIn || []}
              onChange={(keys) => updateField('availableIn', keys)}
              stateOptions={stateOptions}
            />
          </div>
        </div>
      ) : (
        <button
          onClick={createUpdateData}
          className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
          <Plus size={13} /> Create Update Data Transition
        </button>
      )}
      <ChooseExistingVnextComponentDialog
        open={schemaBrowseOpen}
        onOpenChange={setSchemaBrowseOpen}
        category="schemas"
        onSelect={handleSchemaPicked}
      />
      <CreateNewComponentDialog
        open={schemaCreateOpen}
        onOpenChange={setSchemaCreateOpen}
        category="schemas"
        onCreated={handleSchemaPicked}
      />
    </MetadataSection>
  );
}
