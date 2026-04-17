import { useState } from 'react';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { CsxEditorField, type ScriptCode } from '../../../../../modules/save-component/components/CsxEditorField';
import {
  Section,
  EditableInput,
  IconTask,
  IconPlus,
  IconTrash,
  IconUp,
  IconDown,
} from './PropertyPanelShared';
import { Pencil } from 'lucide-react';

/* ────────────── TASKS TAB ────────────── */

export function TasksTab({ state }: { state: any }) {
  const { updateWorkflow } = useWorkflowStore();
  const entries = state.onEntries || [];
  const exits = state.onExits || [];
  const stateKey = state.key;

  const addTask = (listField: 'onEntries' | 'onExits') => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (!s[listField]) s[listField] = [];
      s[listField].push({
        order: s[listField].length + 1,
        task: { key: 'new-task', domain: '', version: '1.0.0', flow: 'sys-tasks' },
      });
    });
  };

  const removeTask = (listField: 'onEntries' | 'onExits', index: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.[listField]) return;
      s[listField].splice(index, 1);
      s[listField].forEach((t: any, i: number) => {
        t.order = i + 1;
      });
    });
  };

  const updateTask = (
    listField: 'onEntries' | 'onExits',
    index: number,
    field: string,
    value: string,
  ) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      const entry = s?.[listField]?.[index];
      if (!entry) return;
      if (!entry.task) entry.task = {};
      entry.task[field] = value;
    });
  };

  const moveTask = (listField: 'onEntries' | 'onExits', fromIndex: number, toIndex: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s?.[listField]) return;
      const arr = s[listField];
      if (toIndex < 0 || toIndex >= arr.length) return;
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      arr.forEach((t: any, i: number) => {
        t.order = i + 1;
      });
    });
  };

  const updateMapping = (
    listField: 'onEntries' | 'onExits',
    index: number,
    mapping: ScriptCode,
  ) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      const entry = s?.[listField]?.[index];
      if (!entry) return;
      entry.mapping = mapping;
    });
  };

  const removeMapping = (listField: 'onEntries' | 'onExits', index: number) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      const entry = s?.[listField]?.[index];
      if (!entry) return;
      delete entry.mapping;
    });
  };

  return (
    <div className="space-y-4">
      <Section title="OnEntry" count={entries.length} icon={<IconTask />} defaultOpen>
        {entries.length === 0 ? (
          <div className="text-muted-foreground py-4 text-center text-[12px]">
            No entry tasks defined
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((t: any, i: number) => (
              <EditableTaskCard
                key={i}
                entry={t}
                index={i}
                total={entries.length}
                listField="onEntries"
                stateKey={stateKey}
                onRemove={removeTask}
                onUpdate={updateTask}
                onMove={moveTask}
                onUpdateMapping={updateMapping}
                onRemoveMapping={removeMapping}
              />
            ))}
          </div>
        )}
        <button
          onClick={() => addTask('onEntries')}
          className="text-secondary-icon hover:text-secondary-foreground mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
          <IconPlus /> Add Entry Task
        </button>
      </Section>

      <Section title="OnExit" count={exits.length} icon={<IconTask />} defaultOpen>
        {exits.length === 0 ? (
          <div className="text-muted-foreground py-4 text-center text-[12px]">
            No exit tasks defined
          </div>
        ) : (
          <div className="space-y-2">
            {exits.map((t: any, i: number) => (
              <EditableTaskCard
                key={i}
                entry={t}
                index={i}
                total={exits.length}
                listField="onExits"
                stateKey={stateKey}
                onRemove={removeTask}
                onUpdate={updateTask}
                onMove={moveTask}
                onUpdateMapping={updateMapping}
                onRemoveMapping={removeMapping}
              />
            ))}
          </div>
        )}
        <button
          onClick={() => addTask('onExits')}
          className="text-secondary-icon hover:text-secondary-foreground mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
          <IconPlus /> Add Exit Task
        </button>
      </Section>
    </div>
  );
}

/* ────────────── EDITABLE TASK CARD ────────────── */

function EditableTaskCard({
  entry,
  index,
  total,
  listField,
  stateKey,
  onRemove,
  onUpdate,
  onMove,
  onUpdateMapping,
  onRemoveMapping,
}: {
  entry: any;
  index: number;
  total: number;
  listField: 'onEntries' | 'onExits';
  stateKey: string;
  onRemove: (listField: 'onEntries' | 'onExits', index: number) => void;
  onUpdate: (
    listField: 'onEntries' | 'onExits',
    index: number,
    field: string,
    value: string,
  ) => void;
  onMove: (listField: 'onEntries' | 'onExits', fromIndex: number, toIndex: number) => void;
  onUpdateMapping: (listField: 'onEntries' | 'onExits', index: number, mapping: ScriptCode) => void;
  onRemoveMapping: (listField: 'onEntries' | 'onExits', index: number) => void;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const ref = entry.task || entry;
  const mapping = entry.mapping;
  const order = entry.order ?? index + 1;

  return (
    <div className="bg-surface border-border hover:border-muted-border-hover overflow-hidden rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {/* Order + Move buttons */}
        <div className="mt-0.5 flex shrink-0 flex-col items-center gap-0.5">
          <button
            onClick={() => onMove(listField, index, index - 1)}
            disabled={index === 0}
            className="text-subtle hover:text-secondary-icon cursor-pointer p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            title="Move up">
            <IconUp />
          </button>
          <span className="bg-intermediate/10 text-intermediate flex size-6 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums">
            {order}
          </span>
          <button
            onClick={() => onMove(listField, index, index + 1)}
            disabled={index === total - 1}
            className="text-subtle hover:text-secondary-icon cursor-pointer p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
            title="Move down">
            <IconDown />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground font-mono text-[12px] font-semibold tracking-tight">
              {ref.key || '?'}
            </span>
            {ref.domain && <span className="text-muted-foreground text-[11px]">@{ref.domain}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            {ref.version && (
              <span className="text-muted-foreground font-mono text-[10px]">v{ref.version}</span>
            )}
            {ref.flow && (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-[10px]">
                {ref.flow}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowEdit(!showEdit)}
            className={`cursor-pointer rounded-lg p-1.5 transition-all ${showEdit ? 'text-secondary-icon bg-secondary' : 'text-subtle hover:text-secondary-icon hover:bg-secondary'}`}>
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onRemove(listField, index)}
            className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1.5 transition-all">
            <IconTrash />
          </button>
        </div>
      </div>

      {showEdit && (
        <div className="border-border-subtle space-y-2 border-t px-3 pt-2.5 pb-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-muted-foreground text-[10px] font-semibold">Key</label>
              <EditableInput
                value={ref.key || ''}
                onChange={(v) => onUpdate(listField, index, 'key', v)}
                mono
              />
            </div>
            <div className="flex-1">
              <label className="text-muted-foreground text-[10px] font-semibold">Domain</label>
              <EditableInput
                value={ref.domain || ''}
                onChange={(v) => onUpdate(listField, index, 'domain', v)}
                mono
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-muted-foreground text-[10px] font-semibold">Version</label>
              <EditableInput
                value={ref.version || ''}
                onChange={(v) => onUpdate(listField, index, 'version', v)}
                mono
              />
            </div>
            <div className="flex-1">
              <label className="text-muted-foreground text-[10px] font-semibold">Flow</label>
              <EditableInput
                value={ref.flow || ''}
                onChange={(v) => onUpdate(listField, index, 'flow', v)}
                mono
              />
            </div>
          </div>
        </div>
      )}

      {/* Mapping Script Editor */}
      <CsxEditorField
        value={mapping}
        onChange={(m) => onUpdateMapping(listField, index, m)}
        onRemove={() => onRemoveMapping(listField, index)}
        templateType="mapping"
        contextName={`${stateKey}-${ref.key || 'task'}`}
        label="Mapping"
        stateKey={stateKey}
        listField={listField}
        index={index}
        scriptField="mapping"
      />
    </div>
  );
}
