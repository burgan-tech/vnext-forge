import { Plus, Trash2, X, Tag, Globe } from 'lucide-react';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';

const inputClass =
  'w-full px-2.5 py-1.5 text-xs font-mono border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle';

export function WorkflowBasicFieldsSection() {
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

  return (
    <>
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
            <div
              key={i}
              className="bg-muted flex items-center gap-1 rounded-lg py-1 pr-1 pl-2.5">
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
    </>
  );
}
