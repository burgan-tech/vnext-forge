import { useState } from 'react';
import { useWorkflowStore } from '@modules/canvas-interaction/workflow-store';
import { SchemaReferenceField, type SchemaReference } from '@modules/save-component/components/SchemaReferenceField';
import { X, ChevronRight, Plus, Trash2, Info, Tag, Globe, Share2, Boxes, Puzzle, Zap } from 'lucide-react';

/* ────────────── Collapsible Section ────────────── */

function Section({ title, icon, defaultOpen = false, children }: { title: string; icon?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden bg-slate-50/50">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left group px-3 py-2.5 hover:bg-slate-100/80 transition-colors">
        <ChevronRight size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className="text-[12px] font-semibold text-slate-600 tracking-tight">{title}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

/* ────────────── Props ────────────── */

interface WorkflowMetadataPanelProps {
  onClose: () => void;
}

/* ────────────── MAIN COMPONENT ────────────── */

export function WorkflowMetadataPanel({ onClose }: WorkflowMetadataPanelProps) {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const wf = workflowJson as any;
  const attrs = wf.attributes || {};

  const updateRoot = (field: string, value: any) => {
    updateWorkflow((draft: any) => { draft[field] = value; });
  };

  const updateAttr = (field: string, value: any) => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes) draft.attributes = {};
      draft.attributes[field] = value;
    });
  };

  /* Tags */
  const tags: string[] = wf.tags || [];
  const addTag = () => {
    updateWorkflow((draft: any) => {
      if (!draft.tags) draft.tags = [];
      draft.tags.push('');
    });
  };
  const removeTag = (index: number) => {
    updateWorkflow((draft: any) => {
      if (draft.tags) draft.tags.splice(index, 1);
    });
  };
  const updateTag = (index: number, value: string) => {
    updateWorkflow((draft: any) => {
      if (draft.tags?.[index] !== undefined) draft.tags[index] = value;
    });
  };

  /* Labels */
  const labels: any[] = attrs.labels || [];
  const addLabel = () => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes.labels) draft.attributes.labels = [];
      draft.attributes.labels.push({ label: '', language: 'en' });
    });
  };
  const removeLabel = (index: number) => {
    updateWorkflow((draft: any) => {
      draft.attributes?.labels?.splice(index, 1);
    });
  };
  const updateLabel = (index: number, field: string, value: string) => {
    updateWorkflow((draft: any) => {
      if (draft.attributes?.labels?.[index]) {
        draft.attributes.labels[index][field] = value;
      }
    });
  };

  /* updateData */
  const updateData = attrs.updateData;

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

  const updateUpdateDataField = (field: string, value: any) => {
    updateWorkflow((draft: any) => {
      if (draft.attributes?.updateData) draft.attributes.updateData[field] = value;
    });
  };

  /* sharedTransitions */
  const sharedTransitions: any[] = attrs.sharedTransitions || [];

  const addSharedTransition = () => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes.sharedTransitions) draft.attributes.sharedTransitions = [];
      draft.attributes.sharedTransitions.push({
        key: `shared-${draft.attributes.sharedTransitions.length + 1}`,
        target: '$self',
        versionStrategy: 'Major',
        triggerType: 0,
        schema: null,
        labels: [{ label: 'Shared Transition', language: 'en' }],
        availableIn: [],
      });
    });
  };

  const removeSharedTransition = (index: number) => {
    updateWorkflow((draft: any) => {
      draft.attributes?.sharedTransitions?.splice(index, 1);
    });
  };

  const updateSharedTransitionField = (index: number, field: string, value: any) => {
    updateWorkflow((draft: any) => {
      if (draft.attributes?.sharedTransitions?.[index]) {
        draft.attributes.sharedTransitions[index][field] = value;
      }
    });
  };

  /* functions / features / extensions */
  const functions: any[] = attrs.functions || [];
  const features: any[] = attrs.features || [];
  const extensions: any[] = attrs.extensions || [];

  const addToArray = (field: string) => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes[field]) draft.attributes[field] = [];
      draft.attributes[field].push({ key: '', domain: '', version: '1.0.0', flow: '' });
    });
  };

  const removeFromArray = (field: string, index: number) => {
    updateWorkflow((draft: any) => {
      draft.attributes?.[field]?.splice(index, 1);
    });
  };

  const updateArrayItem = (field: string, index: number, subField: string, value: string) => {
    updateWorkflow((draft: any) => {
      if (draft.attributes?.[field]?.[index]) {
        draft.attributes[field][index][subField] = value;
      }
    });
  };

  const inputClass = "w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300";

  return (
    <div className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm overflow-y-auto max-h-[450px]">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 bg-white sticky top-0 z-10">
        <div className="size-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <Info size={14} className="text-indigo-500" />
        </div>
        <span className="text-[13px] font-bold text-slate-800 flex-1 tracking-tight">Workflow Settings</span>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Basic fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Key</label>
            <div className="px-2.5 py-1.5 text-xs font-mono bg-slate-100/80 rounded-lg text-slate-500 truncate">{wf.key || '—'}</div>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Domain</label>
            <div className="px-2.5 py-1.5 text-xs font-mono bg-slate-100/80 rounded-lg text-slate-500 truncate">{wf.domain || '—'}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Version</label>
            <input
              type="text"
              value={wf.version || ''}
              onChange={(e) => updateRoot('version', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Type</label>
            <select
              value={attrs.type || 'F'}
              onChange={(e) => updateAttr('type', e.target.value)}
              className={inputClass + ' cursor-pointer'}
            >
              <option value="F">F — Flow</option>
              <option value="P">P — Process</option>
              <option value="S">S — SubFlow</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Flow</label>
            <div className="px-2.5 py-1.5 text-xs font-mono bg-slate-100/80 rounded-lg text-slate-400">{wf.flow || 'sys-flows'}</div>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="text-[10px] text-slate-400 block mb-1 font-semibold tracking-wide">Documentation</label>
          <textarea
            value={wf._comment || ''}
            onChange={(e) => updateRoot('_comment', e.target.value)}
            placeholder="Workflow description (markdown)"
            rows={3}
            className="w-full px-2.5 py-2 text-xs border border-slate-200/80 rounded-xl bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all resize-y font-mono placeholder:text-slate-300"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-[10px] text-slate-400 block mb-1.5 font-semibold tracking-wide flex items-center gap-1"><Tag size={10} /> Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, i) => (
              <div key={i} className="flex items-center gap-1 bg-slate-100/80 rounded-lg pl-2.5 pr-1 py-1">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => updateTag(i, e.target.value)}
                  className="w-16 text-xs bg-transparent border-none p-0 focus:outline-none text-slate-700"
                  placeholder="tag"
                />
                <button onClick={() => removeTag(i)} className="p-0.5 text-slate-400 hover:text-rose-500 rounded transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
            <button onClick={addTag} className="text-[11px] text-indigo-500 hover:text-indigo-600 px-2.5 py-1 border border-dashed border-indigo-200/60 rounded-lg hover:border-indigo-400/60 hover:bg-indigo-50/50 transition-all font-semibold">
              + Tag
            </button>
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="text-[10px] text-slate-400 block mb-1.5 font-semibold tracking-wide flex items-center gap-1"><Globe size={10} /> Labels</label>
          <div className="space-y-1.5">
            {labels.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={l.language}
                  onChange={(e) => updateLabel(i, 'language', e.target.value)}
                  className="w-10 px-2 py-1.5 text-[11px] font-mono text-slate-500 border border-slate-200/80 rounded-lg bg-slate-100/80 text-center shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => updateLabel(i, 'label', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200/80 rounded-lg bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
                />
                <button onClick={() => removeLabel(i)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button onClick={addLabel} className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 font-semibold">
              <Plus size={13} /> Add Label
            </button>
          </div>
        </div>

        {/* ─── updateData ─── */}
        <Section title="Update Data" icon={<Zap size={13} />} defaultOpen={!!updateData}>
          {updateData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Update Data Transition</span>
                <button onClick={removeUpdateData} className="text-[11px] text-rose-400 hover:text-rose-600 font-semibold">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold">Key</label>
                  <input type="text" value={updateData.key || ''} onChange={(e) => updateUpdateDataField('key', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold">Target</label>
                  <div className="px-2.5 py-1.5 text-xs font-mono bg-slate-100/80 rounded-lg text-slate-400">$self</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold">Version Strategy</label>
                  <select value={updateData.versionStrategy || 'Major'} onChange={(e) => updateUpdateDataField('versionStrategy', e.target.value)} className={inputClass + ' cursor-pointer'}>
                    <option value="Minor">Minor</option><option value="Major">Major</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold">Trigger Type</label>
                  <select value={updateData.triggerType ?? 0} onChange={(e) => updateUpdateDataField('triggerType', Number(e.target.value))} className={inputClass + ' cursor-pointer'}>
                    <option value={0}>Manual</option><option value={1}>Auto</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold">Schema</label>
                <SchemaReferenceField value={updateData.schema} onChange={(ref) => updateUpdateDataField('schema', ref)} />
              </div>
            </div>
          ) : (
            <button onClick={createUpdateData} className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 font-semibold">
              <Plus size={13} /> Create updateData Transition
            </button>
          )}
        </Section>

        {/* ─── Shared Transitions ─── */}
        <Section title={`Shared Transitions (${sharedTransitions.length})`} icon={<Share2 size={13} />} defaultOpen={sharedTransitions.length > 0}>
          <div className="space-y-3">
            {sharedTransitions.map((st, i) => (
              <div key={i} className="rounded-xl p-3 bg-white border border-slate-200/80 space-y-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between">
                  <input type="text" value={st.key || ''} onChange={(e) => updateSharedTransitionField(i, 'key', e.target.value)}
                    className="text-xs font-semibold font-mono text-slate-700 bg-transparent border-none p-0 flex-1 focus:outline-none" />
                  <button onClick={() => removeSharedTransition(i)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={13} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold">Target</label>
                    <input type="text" value={st.target || '$self'} onChange={(e) => updateSharedTransitionField(i, 'target', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold">Trigger</label>
                    <select value={st.triggerType ?? 0} onChange={(e) => updateSharedTransitionField(i, 'triggerType', Number(e.target.value))} className={inputClass + ' cursor-pointer'}>
                      <option value={0}>Manual</option><option value={1}>Auto</option><option value={2}>Scheduled</option><option value={3}>Event</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold">Available In (state keys, comma separated)</label>
                  <input type="text" value={(st.availableIn || []).join(', ')}
                    onChange={(e) => updateSharedTransitionField(i, 'availableIn', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                    className={inputClass} placeholder="state-1, state-2" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold">Schema</label>
                  <SchemaReferenceField value={st.schema} onChange={(ref) => updateSharedTransitionField(i, 'schema', ref)} />
                </div>
              </div>
            ))}
            <button onClick={addSharedTransition} className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 font-semibold">
              <Plus size={13} /> Add Shared Transition
            </button>
          </div>
        </Section>

        {/* ─── Functions / Features / Extensions ─── */}
        <ResourceArraySection title="Functions" icon={<Boxes size={13} />} items={functions} field="functions" onAdd={addToArray} onRemove={removeFromArray} onUpdate={updateArrayItem} />
        <ResourceArraySection title="Features" icon={<Puzzle size={13} />} items={features} field="features" onAdd={addToArray} onRemove={removeFromArray} onUpdate={updateArrayItem} />
        <ResourceArraySection title="Extensions" icon={<Zap size={13} />} items={extensions} field="extensions" onAdd={addToArray} onRemove={removeFromArray} onUpdate={updateArrayItem} />
      </div>
    </div>
  );
}

/* ────────────── Resource Array Section ────────────── */

function ResourceArraySection({ title, icon, items, field, onAdd, onRemove, onUpdate }: {
  title: string; icon?: React.ReactNode; items: any[]; field: string;
  onAdd: (field: string) => void;
  onRemove: (field: string, index: number) => void;
  onUpdate: (field: string, index: number, subField: string, value: string) => void;
}) {
  return (
    <Section title={`${title} (${items.length})`} icon={icon}>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <input type="text" value={item.key || ''} onChange={(e) => onUpdate(field, i, 'key', e.target.value)}
              placeholder="key" className="flex-1 text-xs font-mono bg-transparent border-none p-0 focus:outline-none placeholder:text-slate-300 text-slate-700" />
            <span className="text-[11px] text-slate-300 font-semibold">@</span>
            <input type="text" value={item.domain || ''} onChange={(e) => onUpdate(field, i, 'domain', e.target.value)}
              placeholder="domain" className="flex-1 text-xs font-mono bg-transparent border-none p-0 focus:outline-none placeholder:text-slate-300 text-slate-700" />
            <button onClick={() => onRemove(field, i)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={13} /></button>
          </div>
        ))}
        <button onClick={() => onAdd(field)} className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 font-semibold">
          <Plus size={13} /> Add {title.slice(0, -1)}
        </button>
      </div>
    </Section>
  );
}
