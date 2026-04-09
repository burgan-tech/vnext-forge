import { useState } from 'react';
import { useWorkflowStore } from '@modules/canvas-interaction/WorkflowStore';
import { CsxEditorField, type ScriptCode } from '@modules/save-component/components/CsxEditorField';
import { Section, EditableInput, IconTask, IconPlus, IconTrash, IconUp, IconDown } from './Shared';
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
      s[listField].forEach((t: any, i: number) => { t.order = i + 1; });
    });
  };

  const updateTask = (listField: 'onEntries' | 'onExits', index: number, field: string, value: string) => {
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
      arr.forEach((t: any, i: number) => { t.order = i + 1; });
    });
  };

  const updateMapping = (listField: 'onEntries' | 'onExits', index: number, mapping: ScriptCode) => {
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
          <div className="text-[12px] text-slate-400 py-4 text-center">No entry tasks defined</div>
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
        <button onClick={() => addTask('onEntries')} className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 mt-2 font-semibold">
          <IconPlus /> Add Entry Task
        </button>
      </Section>

      <Section title="OnExit" count={exits.length} icon={<IconTask />} defaultOpen>
        {exits.length === 0 ? (
          <div className="text-[12px] text-slate-400 py-4 text-center">No exit tasks defined</div>
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
        <button onClick={() => addTask('onExits')} className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 mt-2 font-semibold">
          <IconPlus /> Add Exit Task
        </button>
      </Section>
    </div>
  );
}

/* ────────────── EDITABLE TASK CARD ────────────── */

function EditableTaskCard({ entry, index, total, listField, stateKey, onRemove, onUpdate, onMove, onUpdateMapping, onRemoveMapping }: {
  entry: any; index: number; total: number; listField: 'onEntries' | 'onExits'; stateKey: string;
  onRemove: (listField: 'onEntries' | 'onExits', index: number) => void;
  onUpdate: (listField: 'onEntries' | 'onExits', index: number, field: string, value: string) => void;
  onMove: (listField: 'onEntries' | 'onExits', fromIndex: number, toIndex: number) => void;
  onUpdateMapping: (listField: 'onEntries' | 'onExits', index: number, mapping: ScriptCode) => void;
  onRemoveMapping: (listField: 'onEntries' | 'onExits', index: number) => void;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const ref = entry.task || entry;
  const mapping = entry.mapping;
  const order = entry.order ?? index + 1;

  return (
    <div className="rounded-xl overflow-hidden bg-white border border-slate-200/80 hover:border-slate-300/80 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        {/* Order + Move buttons */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
          <button
            onClick={() => onMove(listField, index, index - 1)}
            disabled={index === 0}
            className="p-0.5 text-slate-300 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move up"
          >
            <IconUp />
          </button>
          <span className="size-6 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-[11px] font-bold tabular-nums">
            {order}
          </span>
          <button
            onClick={() => onMove(listField, index, index + 1)}
            disabled={index === total - 1}
            className="p-0.5 text-slate-300 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            <IconDown />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold text-slate-900 font-mono tracking-tight">{ref.key || '?'}</span>
            {ref.domain && <span className="text-[11px] text-slate-400">@{ref.domain}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {ref.version && <span className="text-[10px] text-slate-400 font-mono">v{ref.version}</span>}
            {ref.flow && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100/80 text-slate-500 font-mono">{ref.flow}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowEdit(!showEdit)} className={`p-1.5 rounded-lg transition-all ${showEdit ? 'text-indigo-500 bg-indigo-50' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}>
            <Pencil size={12} />
          </button>
          <button onClick={() => onRemove(listField, index)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
            <IconTrash />
          </button>
        </div>
      </div>

      {showEdit && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2.5">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 font-semibold">Key</label>
              <EditableInput value={ref.key || ''} onChange={(v) => onUpdate(listField, index, 'key', v)} mono />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 font-semibold">Domain</label>
              <EditableInput value={ref.domain || ''} onChange={(v) => onUpdate(listField, index, 'domain', v)} mono />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 font-semibold">Version</label>
              <EditableInput value={ref.version || ''} onChange={(v) => onUpdate(listField, index, 'version', v)} mono />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 font-semibold">Flow</label>
              <EditableInput value={ref.flow || ''} onChange={(v) => onUpdate(listField, index, 'flow', v)} mono />
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
