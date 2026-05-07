import { useState, useCallback } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { MappingCode, ResourceReference, ViewBinding } from '@vnext-forge-studio/vnext-types';
import type { ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { CsxEditorField } from '../../../../../../modules/save-component/components/CsxEditorField';
import { OpenVnextComponentInModalButton } from '../../../../../../modules/save-component/components/OpenVnextComponentInModalButton.js';
import { ChooseFromExistingVnextComponentButton } from '../ChooseExistingTaskDialog';
import { CreateNewComponentButton } from '../CreateNewComponentDialog';
import { EditableInput, IconPlus, IconTrash, Section } from '../PropertyPanelShared';

type ViewMode = 'single' | 'rule-based';

export interface ViewBindingsSectionProps {
  view: ViewBinding | null;
  views: ViewBinding[];
  onUpdateView: (view: ViewBinding | null) => void;
  onUpdateViews: (views: ViewBinding[]) => void;
  onBrowseView: (bindingIndex: number | null) => void;
  onCreateView: (bindingIndex: number | null) => void;
  onBrowseExtension: (bindingIndex: number | null) => void;
  canPickExisting: boolean;
  /** Unique context identifier for CSX editor keying, e.g. "myState" or "myState-approve-0" */
  contextId: string;
  /** JSON path prefix for script fields, e.g. "view" or "transitions[0].views" */
  scriptFieldPrefix: string;
  stateKey: string;
  /** Parent list field for CsxEditorField (e.g. "transitions"). Omit for state-level views. */
  listField?: string;
  /** Index within the parent list for CsxEditorField. Omit for state-level views. */
  listIndex?: number;
  /** Description text shown below the section title. */
  description?: string;
}

export function inferViewMode(view: ViewBinding | null | undefined, views: ViewBinding[] | undefined): ViewMode {
  if (views && views.length > 0) return 'rule-based';
  return 'single';
}

export const EMPTY_VIEW_REF: ResourceReference = { key: '', domain: '', version: '1.0.0', flow: 'sys-views' };
export const EMPTY_VIEW_BINDING: ViewBinding = { view: { ...EMPTY_VIEW_REF }, loadData: false };

export function ViewBindingsSection({
  view,
  views,
  onUpdateView,
  onUpdateViews,
  onBrowseView,
  onCreateView,
  onBrowseExtension,
  canPickExisting,
  contextId,
  scriptFieldPrefix,
  stateKey,
  listField,
  listIndex,
  description = 'Assign a view. Use rule-based mode for conditional view selection.',
}: ViewBindingsSectionProps) {
  const [mode, setMode] = useState<ViewMode>(() => inferViewMode(view, views));

  const switchMode = useCallback(
    (next: ViewMode) => {
      if (next === mode) return;

      if (next === 'rule-based') {
        if (view) {
          onUpdateViews([view]);
          onUpdateView(null);
        } else {
          onUpdateViews([]);
        }
      } else {
        if (views.length === 1) {
          onUpdateView(views[0]);
          onUpdateViews([]);
        } else if (views.length === 0) {
          onUpdateViews([]);
        } else {
          onUpdateView(views[0] ?? null);
          onUpdateViews([]);
        }
      }
      setMode(next);
    },
    [mode, view, views, onUpdateView, onUpdateViews],
  );

  const updateViewRefField = (field: keyof ResourceReference, value: string) => {
    if (!view) return;
    onUpdateView({ ...view, view: { ...view.view, [field]: value } });
  };

  const toggleSingleLoadData = () => {
    if (!view) return;
    onUpdateView({ ...view, loadData: !view.loadData });
  };

  const addSingleExtension = (ext: string) => {
    if (!view) return;
    const exts = [...(view.extensions ?? [])];
    if (!exts.includes(ext)) exts.push(ext);
    onUpdateView({ ...view, extensions: exts });
  };

  const removeSingleExtension = (ext: string) => {
    if (!view) return;
    const exts = (view.extensions ?? []).filter((e) => e !== ext);
    onUpdateView({ ...view, extensions: exts.length > 0 ? exts : undefined });
  };

  const addBinding = () => {
    onUpdateViews([...views, { ...EMPTY_VIEW_BINDING, view: { ...EMPTY_VIEW_REF } }]);
  };

  const removeBinding = (i: number) => {
    onUpdateViews(views.filter((_, idx) => idx !== i));
  };

  const updateBindingView = (i: number, field: keyof ResourceReference, value: string) => {
    const next = [...views];
    next[i] = { ...next[i], view: { ...next[i].view, [field]: value } };
    onUpdateViews(next);
  };

  const updateBindingRule = (i: number, script: ScriptCode) => {
    const next = [...views];
    next[i] = { ...next[i], rule: script as MappingCode };
    onUpdateViews(next);
  };

  const removeBindingRule = (i: number) => {
    const next = [...views];
    const copy = { ...next[i] };
    delete copy.rule;
    next[i] = copy;
    onUpdateViews(next);
  };

  const toggleLoadData = (i: number) => {
    const next = [...views];
    next[i] = { ...next[i], loadData: !next[i].loadData };
    onUpdateViews(next);
  };

  const addExtension = (i: number, ext: string) => {
    const next = [...views];
    const exts = [...(next[i].extensions ?? [])];
    if (!exts.includes(ext)) exts.push(ext);
    next[i] = { ...next[i], extensions: exts };
    onUpdateViews(next);
  };

  const removeExtension = (i: number, ext: string) => {
    const next = [...views];
    const exts = (next[i].extensions ?? []).filter((e) => e !== ext);
    next[i] = { ...next[i], extensions: exts.length > 0 ? exts : undefined };
    onUpdateViews(next);
  };

  const moveBinding = useCallback((from: number, to: number) => {
    if (to < 0 || to >= views.length) return;
    const next = [...views];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onUpdateViews(next);
  }, [views, onUpdateViews]);

  const hasContent = view != null || views.length > 0;

  return (
    <Section title="Views" count={views.length || (view ? 1 : 0)} defaultOpen={hasContent}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        {description}
      </p>

      {/* Mode toggle */}
      <div className="bg-muted mb-3 flex gap-0.5 rounded-lg p-0.5" role="radiogroup" aria-label="View mode">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'single'}
          onClick={() => switchMode('single')}
          className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
            mode === 'single'
              ? 'bg-surface text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}>
          Single view
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'rule-based'}
          onClick={() => switchMode('rule-based')}
          className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer ${
            mode === 'rule-based'
              ? 'bg-surface text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}>
          Rule-based views
        </button>
      </div>

      {mode === 'single' && (
        <SingleViewMode
          binding={view}
          onUpdateBinding={onUpdateView}
          updateRefField={updateViewRefField}
          toggleLoadData={toggleSingleLoadData}
          addExtension={addSingleExtension}
          removeExtension={removeSingleExtension}
          onBrowse={() => onBrowseView(null)}
          onCreate={() => onCreateView(null)}
          onBrowseExtension={() => onBrowseExtension(null)}
          canPickExisting={canPickExisting}
        />
      )}

      {mode === 'rule-based' && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-0.5">
          {views.map((binding, i) => (
            <ViewBindingCard
              key={i}
              binding={binding}
              index={i}
              total={views.length}
              contextId={contextId}
              scriptFieldPrefix={scriptFieldPrefix}
              stateKey={stateKey}
              listField={listField}
              listIndex={listIndex}
              onRemove={() => removeBinding(i)}
              onMoveUp={() => moveBinding(i, i - 1)}
              onMoveDown={() => moveBinding(i, i + 1)}
              onUpdateViewField={(field, value) => updateBindingView(i, field, value)}
              onUpdateRule={(script) => updateBindingRule(i, script)}
              onRemoveRule={() => removeBindingRule(i)}
              onToggleLoadData={() => toggleLoadData(i)}
              onAddExtension={(ext) => addExtension(i, ext)}
              onRemoveExtension={(ext) => removeExtension(i, ext)}
              onBrowseView={() => onBrowseView(i)}
              onCreate={() => onCreateView(i)}
              onBrowseExtension={() => onBrowseExtension(i)}
              canPickExisting={canPickExisting}
            />
          ))}

          <button
            type="button"
            onClick={addBinding}
            className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
            <IconPlus />
            Add view binding
          </button>
        </div>
      )}
    </Section>
  );
}

/* ─── Single-view sub-component ─── */

function SingleViewMode({
  binding,
  onUpdateBinding,
  updateRefField,
  toggleLoadData,
  addExtension,
  removeExtension,
  onBrowse,
  onCreate,
  onBrowseExtension,
  canPickExisting,
}: {
  binding: ViewBinding | null;
  onUpdateBinding: (v: ViewBinding | null) => void;
  updateRefField: (field: keyof ResourceReference, value: string) => void;
  toggleLoadData: () => void;
  addExtension: (ext: string) => void;
  removeExtension: (ext: string) => void;
  onBrowse: () => void;
  onCreate: () => void;
  onBrowseExtension: () => void;
  canPickExisting: boolean;
}) {
  const hasView = binding !== null && binding !== undefined;
  const [extInput, setExtInput] = useState('');

  const handleExtKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && extInput.trim()) {
      e.preventDefault();
      addExtension(extInput.trim());
      setExtInput('');
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <ChooseFromExistingVnxtComponentButton category="views" onClick={onBrowse} disabled={!canPickExisting} />
        <CreateNewComponentButton category="views" onClick={onCreate} disabled={!canPickExisting} />
      </div>

      {!hasView ? (
        <button
          type="button"
          onClick={() => onUpdateBinding({ ...EMPTY_VIEW_BINDING, view: { ...EMPTY_VIEW_REF } })}
          className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Add view manually
        </button>
      ) : (
        <div className="space-y-2">
          <ResourceReferenceFields
            ref_={binding.view}
            updateField={updateRefField}
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={binding.loadData ?? false}
              onChange={toggleLoadData}
              className="accent-primary size-3.5 cursor-pointer"
            />
            <span className="text-[10px] text-foreground font-medium">Load data</span>
          </label>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
              Extensions
            </label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {(binding.extensions ?? []).map((ext) => (
                <span
                  key={ext}
                  className="bg-muted text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono">
                  {ext}
                  <button
                    type="button"
                    onClick={() => removeExtension(ext)}
                    className="text-subtle hover:text-destructive-text cursor-pointer"
                    aria-label={`Remove extension ${ext}`}>
                    <X className="size-2.5" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={extInput}
                onChange={(e) => setExtInput(e.target.value)}
                onKeyDown={handleExtKeyDown}
                placeholder="Type extension key + Enter"
                className="flex-1 px-2 py-1 text-[10px] border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-ring/20"
                aria-label="Extension key"
              />
              <ChooseFromExistingVnxtComponentButton
                category="extensions"
                onClick={onBrowseExtension}
                disabled={!canPickExisting}
              />
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onUpdateBinding(null)}
              className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors">
              <IconTrash />
              Clear view
            </button>
            {binding.view.key && binding.view.flow && (
              <OpenVnextComponentInModalButton
                componentKey={binding.view.key}
                flow={binding.view.flow}
                title="Open view JSON in modal editor"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ResourceReference editor fields ─── */

export function ResourceReferenceFields({
  ref_,
  updateField,
}: {
  ref_: ResourceReference;
  updateField: (field: keyof ResourceReference, value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
          Resource key
        </label>
        <EditableInput
          value={ref_.key}
          onChange={(v) => updateField('key', v)}
          mono
          placeholder="e.g. approval-view"
        />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Domain</label>
        <EditableInput
          value={ref_.domain}
          onChange={(v) => updateField('domain', v)}
          mono
          placeholder="e.g. my-domain"
        />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
          Version
        </label>
        <EditableInput
          value={ref_.version}
          onChange={(v) => updateField('version', v)}
          mono
          placeholder="1.0.0"
        />
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Flow</label>
        <EditableInput
          value={ref_.flow}
          onChange={(v) => updateField('flow', v)}
          mono
          placeholder="sys-views"
        />
      </div>
    </div>
  );
}

/* ─── ViewBinding card (rule-based mode) ─── */

function ViewBindingCard({
  binding,
  index,
  total,
  contextId,
  scriptFieldPrefix,
  stateKey,
  listField,
  listIndex,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdateViewField,
  onUpdateRule,
  onRemoveRule,
  onToggleLoadData,
  onAddExtension,
  onRemoveExtension,
  onBrowseView,
  onCreate,
  onBrowseExtension,
  canPickExisting,
}: {
  binding: ViewBinding;
  index: number;
  total: number;
  contextId: string;
  scriptFieldPrefix: string;
  stateKey: string;
  listField?: string;
  listIndex?: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateViewField: (field: keyof ResourceReference, value: string) => void;
  onUpdateRule: (script: ScriptCode) => void;
  onRemoveRule: () => void;
  onToggleLoadData: () => void;
  onAddExtension: (ext: string) => void;
  onRemoveExtension: (ext: string) => void;
  onBrowseView: () => void;
  onCreate: () => void;
  onBrowseExtension: () => void;
  canPickExisting: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [extInput, setExtInput] = useState('');

  const handleExtKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && extInput.trim()) {
      e.preventDefault();
      onAddExtension(extInput.trim());
      setExtInput('');
    }
  };

  const viewLabel = binding.view.key
    ? `${binding.view.key}@${binding.view.domain || '?'}`
    : 'No view configured';

  const hasViewRef = Boolean(binding.view.key && binding.view.flow);

  return (
    <div className="bg-muted-surface border-border rounded-lg border overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-1.5 text-left cursor-pointer"
          aria-expanded={expanded}
          aria-label={`View binding ${index + 1}`}>
          <span className="bg-muted text-muted-foreground inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold">
            {index + 1}
          </span>
          <span className="text-[10px] font-mono text-foreground truncate flex-1">
            {viewLabel}
          </span>
          <ChevronRight
            size={12}
            className={`text-muted-foreground shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          {index > 0 && (
            <button type="button" onClick={onMoveUp} className="text-subtle hover:text-foreground p-0.5 cursor-pointer text-[10px]" aria-label="Move up" title="Move up">
              ↑
            </button>
          )}
          {index < total - 1 && (
            <button type="button" onClick={onMoveDown} className="text-subtle hover:text-foreground p-0.5 cursor-pointer text-[10px]" aria-label="Move down" title="Move down">
              ↓
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-subtle hover:text-destructive-text p-0.5 cursor-pointer"
            aria-label={`Remove view binding ${index + 1}`}>
            <IconTrash />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2">
          <div>
            <CsxEditorField
              value={(binding.rule as ScriptCode | undefined) ?? null}
              onChange={onUpdateRule}
              onRemove={onRemoveRule}
              templateType="condition"
              contextName={`${contextId}-view-rule-${index}`}
              label="Rule (optional)"
              stateKey={stateKey}
              listField={listField ?? 'views'}
              index={listIndex ?? index}
              scriptField={`${scriptFieldPrefix}[${index}].rule`}
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">View</label>
            <div className="mb-1.5 flex flex-wrap items-center gap-3">
              <ChooseFromExistingVnxtComponentButton category="views" onClick={onBrowseView} disabled={!canPickExisting} />
              <CreateNewComponentButton category="views" onClick={onCreate} disabled={!canPickExisting} />
            </div>
            <ResourceReferenceFields
              ref_={binding.view}
              updateField={onUpdateViewField}
            />
            {hasViewRef && (
              <div className="mt-1.5">
                <OpenVnextComponentInModalButton
                  componentKey={binding.view.key}
                  flow={binding.view.flow}
                  title="Open view JSON in modal editor"
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={binding.loadData ?? false}
              onChange={onToggleLoadData}
              className="accent-primary size-3.5 cursor-pointer"
            />
            <span className="text-[10px] text-foreground font-medium">Load data</span>
          </label>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
              Extensions
            </label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {(binding.extensions ?? []).map((ext) => (
                <span
                  key={ext}
                  className="bg-muted text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono">
                  {ext}
                  <button
                    type="button"
                    onClick={() => onRemoveExtension(ext)}
                    className="text-subtle hover:text-destructive-text cursor-pointer"
                    aria-label={`Remove extension ${ext}`}>
                    <X className="size-2.5" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={extInput}
                onChange={(e) => setExtInput(e.target.value)}
                onKeyDown={handleExtKeyDown}
                placeholder="Type extension key + Enter"
                className="flex-1 px-2 py-1 text-[10px] border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-ring/20"
                aria-label="Extension key"
              />
              <ChooseFromExistingVnxtComponentButton
                category="extensions"
                onClick={onBrowseExtension}
                disabled={!canPickExisting}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChooseFromExistingVnxtComponentButton(props: {
  category: 'views' | 'extensions';
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <ChooseFromExistingVnextComponentButton
      category={props.category}
      onClick={props.onClick}
      disabled={props.disabled}
    />
  );
}
