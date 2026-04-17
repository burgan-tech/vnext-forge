import { useState } from 'react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { SchemaReferenceField } from '../../../../modules/save-component/components/SchemaReferenceField';
import {
  X,
  ChevronRight,
  Plus,
  Trash2,
  Info,
  Tag,
  Globe,
  Share2,
  Boxes,
  Puzzle,
  Zap,
} from 'lucide-react';

/* ────────────── Collapsible Section ────────────── */

function Section({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-muted-surface overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="group hover:bg-muted flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors">
        <ChevronRight
          size={14}
          className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-muted-foreground text-[12px] font-semibold tracking-tight">
          {title}
        </span>
      </button>
      {open && <div className="px-3 pt-1 pb-3">{children}</div>}
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
    updateWorkflow((draft: any) => {
      draft[field] = value;
    });
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

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs font-mono border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle';

  return (
    <div className="border-border bg-surface/80 max-h-112.5 overflow-y-auto border-b backdrop-blur-sm">
      {/* Header */}
      <div className="border-border-subtle bg-surface sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-3">
        <div className="bg-secondary-muted flex size-7 items-center justify-center rounded-lg">
          <Info size={14} className="text-secondary-icon" />
        </div>
        <span className="text-foreground flex-1 text-[13px] font-bold tracking-tight">
          Workflow Settings
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-primary-icon hover:bg-muted cursor-pointer rounded-xl p-1.5 transition-all">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Basic fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
              Key
            </label>
            <div className="bg-muted text-muted-foreground truncate rounded-lg px-2.5 py-1.5 font-mono text-xs">
              {wf.key || '—'}
            </div>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
              Domain
            </label>
            <div className="bg-muted text-muted-foreground truncate rounded-lg px-2.5 py-1.5 font-mono text-xs">
              {wf.domain || '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
              Version
            </label>
            <input
              type="text"
              value={wf.version || ''}
              onChange={(e) => updateRoot('version', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
              Type
            </label>
            <select
              value={attrs.type || 'F'}
              onChange={(e) => updateAttr('type', e.target.value)}
              className={inputClass + ' cursor-pointer'}>
              <option value="F">F — Flow</option>
              <option value="P">P — Process</option>
              <option value="S">S — SubFlow</option>
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
              Flow
            </label>
            <div className="bg-muted text-muted-foreground rounded-lg px-2.5 py-1.5 font-mono text-xs">
              {wf.flow || 'sys-flows'}
            </div>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide">
            Documentation
          </label>
          <textarea
            value={wf._comment || ''}
            onChange={(e) => updateRoot('_comment', e.target.value)}
            placeholder="Workflow description (markdown)"
            rows={3}
            className="border-border bg-muted-surface text-foreground focus:ring-ring/20 focus:border-primary-border focus:bg-surface placeholder:text-subtle w-full resize-y rounded-xl border px-2.5 py-2 font-mono text-xs transition-all focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-muted-foreground mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide">
            <Tag size={10} /> Tags
          </label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, i) => (
              <div key={i} className="bg-muted flex items-center gap-1 rounded-lg py-1 pr-1 pl-2.5">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => updateTag(i, e.target.value)}
                  className="text-foreground w-16 border-none bg-transparent p-0 text-xs focus:outline-none"
                  placeholder="tag"
                />
                <button
                  onClick={() => removeTag(i)}
                  className="text-muted-foreground hover:text-destructive-text cursor-pointer rounded p-0.5 transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={addTag}
              className="text-secondary-icon hover:text-secondary-foreground border-secondary-border/60 hover:border-secondary-border hover:bg-secondary cursor-pointer rounded-lg border border-dashed px-2.5 py-1 text-[11px] font-semibold transition-all">
              + Tag
            </button>
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="text-muted-foreground mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide">
            <Globe size={10} /> Labels
          </label>
          <div className="space-y-1.5">
            {labels.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={l.language}
                  onChange={(e) => updateLabel(i, 'language', e.target.value)}
                  className="text-muted-foreground border-border bg-muted focus:ring-ring/20 w-10 shrink-0 rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] focus:ring-2 focus:outline-none"
                />
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => updateLabel(i, 'label', e.target.value)}
                  className="border-border bg-muted-surface text-foreground focus:ring-ring/20 focus:border-primary-border focus:bg-surface flex-1 rounded-lg border px-2.5 py-1.5 text-xs transition-all focus:ring-2 focus:outline-none"
                />
                <button
                  onClick={() => removeLabel(i)}
                  className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={addLabel}
              className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
              <Plus size={13} /> Add Label
            </button>
          </div>
        </div>

        {/* ─── updateData ─── */}
        <Section title="Update Data" icon={<Zap size={13} />} defaultOpen={!!updateData}>
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
                    onChange={(e) => updateUpdateDataField('key', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold">Target</label>
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
                    onChange={(e) => updateUpdateDataField('versionStrategy', e.target.value)}
                    className={inputClass + ' cursor-pointer'}>
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
                    onChange={(e) => updateUpdateDataField('triggerType', Number(e.target.value))}
                    className={inputClass + ' cursor-pointer'}>
                    <option value={0}>Manual</option>
                    <option value={1}>Auto</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] font-semibold">Schema</label>
                <SchemaReferenceField
                  value={updateData.schema}
                  onChange={(ref) => updateUpdateDataField('schema', ref)}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={createUpdateData}
              className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
              <Plus size={13} /> Create updateData Transition
            </button>
          )}
        </Section>

        {/* ─── Shared Transitions ─── */}
        <Section
          title={`Shared Transitions (${sharedTransitions.length})`}
          icon={<Share2 size={13} />}
          defaultOpen={sharedTransitions.length > 0}>
          <div className="space-y-3">
            {sharedTransitions.map((st, i) => (
              <div
                key={i}
                className="bg-surface border-border space-y-2 rounded-xl border p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={st.key || ''}
                    onChange={(e) => updateSharedTransitionField(i, 'key', e.target.value)}
                    className="text-foreground flex-1 border-none bg-transparent p-0 font-mono text-xs font-semibold focus:outline-none"
                  />
                  <button
                    onClick={() => removeSharedTransition(i)}
                    className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground text-[10px] font-semibold">
                      Target
                    </label>
                    <input
                      type="text"
                      value={st.target || '$self'}
                      onChange={(e) => updateSharedTransitionField(i, 'target', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground text-[10px] font-semibold">
                      Trigger
                    </label>
                    <select
                      value={st.triggerType ?? 0}
                      onChange={(e) =>
                        updateSharedTransitionField(i, 'triggerType', Number(e.target.value))
                      }
                      className={inputClass + ' cursor-pointer'}>
                      <option value={0}>Manual</option>
                      <option value={1}>Auto</option>
                      <option value={2}>Scheduled</option>
                      <option value={3}>Event</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold">
                    Available In (state keys, comma separated)
                  </label>
                  <input
                    type="text"
                    value={(st.availableIn || []).join(', ')}
                    onChange={(e) =>
                      updateSharedTransitionField(
                        i,
                        'availableIn',
                        e.target.value
                          .split(',')
                          .map((s: string) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    className={inputClass}
                    placeholder="state-1, state-2"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold">Schema</label>
                  <SchemaReferenceField
                    value={st.schema}
                    onChange={(ref) => updateSharedTransitionField(i, 'schema', ref)}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addSharedTransition}
              className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
              <Plus size={13} /> Add Shared Transition
            </button>
          </div>
        </Section>

        {/* ─── Functions / Features / Extensions ─── */}
        <ResourceArraySection
          title="Functions"
          icon={<Boxes size={13} />}
          items={functions}
          field="functions"
          onAdd={addToArray}
          onRemove={removeFromArray}
          onUpdate={updateArrayItem}
        />
        <ResourceArraySection
          title="Features"
          icon={<Puzzle size={13} />}
          items={features}
          field="features"
          onAdd={addToArray}
          onRemove={removeFromArray}
          onUpdate={updateArrayItem}
        />
        <ResourceArraySection
          title="Extensions"
          icon={<Zap size={13} />}
          items={extensions}
          field="extensions"
          onAdd={addToArray}
          onRemove={removeFromArray}
          onUpdate={updateArrayItem}
        />
      </div>
    </div>
  );
}

/* ────────────── Resource Array Section ────────────── */

function ResourceArraySection({
  title,
  icon,
  items,
  field,
  onAdd,
  onRemove,
  onUpdate,
}: {
  title: string;
  icon?: React.ReactNode;
  items: any[];
  field: string;
  onAdd: (field: string) => void;
  onRemove: (field: string, index: number) => void;
  onUpdate: (field: string, index: number, subField: string, value: string) => void;
}) {
  return (
    <Section title={`${title} (${items.length})`} icon={icon}>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div
            key={i}
            className="bg-surface border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <input
              type="text"
              value={item.key || ''}
              onChange={(e) => onUpdate(field, i, 'key', e.target.value)}
              placeholder="key"
              className="placeholder:text-subtle text-foreground flex-1 border-none bg-transparent p-0 font-mono text-xs focus:outline-none"
            />
            <span className="text-subtle text-[11px] font-semibold">@</span>
            <input
              type="text"
              value={item.domain || ''}
              onChange={(e) => onUpdate(field, i, 'domain', e.target.value)}
              placeholder="domain"
              className="placeholder:text-subtle text-foreground flex-1 border-none bg-transparent p-0 font-mono text-xs focus:outline-none"
            />
            <button
              onClick={() => onRemove(field, i)}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface cursor-pointer rounded-lg p-1 transition-all">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onAdd(field)}
          className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
          <Plus size={13} /> Add {title.slice(0, -1)}
        </button>
      </div>
    </Section>
  );
}
