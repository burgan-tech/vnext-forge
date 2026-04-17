import { useCallback, useMemo } from 'react';
import { encodeToBase64, decodeFromBase64 } from '../../../modules/code-editor/editor/Base64Handler';
import { generateTemplate, type TemplateType } from '../../../modules/code-editor/editor/CsxTemplates';
import { useScriptPanelStore, type ActiveScript } from '../../../modules/code-editor/ScriptPanelStore';
import { useUIStore } from '../../../store/useUiStore';
import type { CsxTaskType } from '../../../modules/code-editor/editor/CsxContext';
import { Code2, Plus, Trash2, ExternalLink } from 'lucide-react';

/* ────────────── Types ────────────── */

export interface ScriptCode {
  location: string;
  code: string;
  encoding?: string;
}

export type { TemplateType };

interface CsxEditorFieldProps {
  value: ScriptCode | null | undefined;
  onChange: (value: ScriptCode) => void;
  onRemove?: () => void;
  templateType: TemplateType;
  contextName?: string;
  taskType?: CsxTaskType;
  label?: string;
  /** State key owning this script */
  stateKey: string;
  /** List field: 'onEntries' | 'onExits' | 'transitions' */
  listField: string;
  /** Index within the list */
  index: number;
  /** Script field on the entry: 'mapping' | 'rule' | 'condition' | 'timer' */
  scriptField: string;
}

/* ────────────── Component ────────────── */

export function CsxEditorField({
  value,
  onChange,
  onRemove,
  templateType,
  contextName,
  taskType,
  label,
  stateKey,
  listField,
  index,
  scriptField,
}: CsxEditorFieldProps) {
  const { openScript, activeScript } = useScriptPanelStore();
  const { setScriptPanelOpen } = useUIStore();

  const decoded = useMemo(() => {
    if (!value?.code) return '';
    return decodeFromBase64(value.code);
  }, [value?.code]);

  // Preview: first 3 non-empty lines of the script
  const previewLines = useMemo(() => {
    if (!decoded) return [];
    return decoded
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)
      .slice(0, 3);
  }, [decoded]);

  const lineCount = useMemo(() => {
    return decoded ? decoded.split('\n').length : 0;
  }, [decoded]);

  const handleCreate = useCallback(() => {
    const { location, code } = generateTemplate(templateType, contextName, taskType);
    const newValue: ScriptCode = {
      location,
      code: encodeToBase64(code),
      encoding: 'B64',
    };
    onChange(newValue);

    // Open in bottom panel immediately
    const script: ActiveScript = {
      stateKey,
      listField,
      index,
      scriptField,
      value: newValue,
      templateType,
      label: label || templateType,
      contextName,
      taskType,
    };
    openScript(script);
    setScriptPanelOpen(true);
  }, [
    templateType,
    contextName,
    taskType,
    onChange,
    stateKey,
    listField,
    index,
    scriptField,
    label,
    openScript,
    setScriptPanelOpen,
  ]);

  const handleOpenInPanel = useCallback(() => {
    if (!value) return;
    const script: ActiveScript = {
      stateKey,
      listField,
      index,
      scriptField,
      value,
      templateType,
      label: label || value.location || templateType,
      contextName,
      taskType,
    };
    openScript(script);
    setScriptPanelOpen(true);
  }, [
    value,
    stateKey,
    listField,
    index,
    scriptField,
    templateType,
    label,
    contextName,
    taskType,
    openScript,
    setScriptPanelOpen,
  ]);

  // Check if this exact script is currently open in the bottom panel
  const isActive =
    activeScript?.stateKey === stateKey &&
    activeScript?.listField === listField &&
    activeScript?.index === index &&
    activeScript?.scriptField === scriptField;

  /* ── No script → Create button ── */
  if (!value || !value.code) {
    return (
      <div className="mt-2">
        <button
          onClick={handleCreate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary-border px-3 py-2.5 text-[12px] font-semibold text-primary-text transition-all hover:border-primary-border-hover hover:bg-primary-hover">
          <Plus size={14} />
          <span>Create {label || templateType}</span>
        </button>
      </div>
    );
  }

  /* ── Script exists → Compact preview card ── */
  return (
    <div
      className={`mt-0.5 border-t transition-colors ${isActive ? 'border-secondary-border bg-secondary-surface' : 'border-border-subtle'}`}>
      {/* Header — click to open in panel */}
      <button
        onClick={handleOpenInPanel}
        className={`group flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
          isActive ? 'bg-secondary-surface' : 'hover:bg-muted-surface'
        }`}>
        <div
          className={`flex size-5 shrink-0 items-center justify-center rounded-md ${
            isActive ? 'bg-secondary-muted text-secondary-icon' : 'bg-primary-muted text-primary-icon'
          }`}>
          <Code2 size={11} className="text-current" />
        </div>
        <span className="flex-1 truncate font-mono text-[11px] font-medium text-foreground">
          {value.location || label || templateType}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
          {lineCount}L
        </span>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="shrink-0 rounded-md p-1 text-muted-icon transition-all hover:bg-destructive-surface hover:text-destructive-text"
            title="Remove script">
            <Trash2 size={12} />
          </button>
        )}
        <ExternalLink
          size={12}
          className={`shrink-0 transition-all ${
            isActive ? 'text-secondary-icon' : 'text-muted-icon group-hover:text-secondary-icon'
          }`}
        />
      </button>

      {/* Code preview (readonly, 3 lines max) */}
      {previewLines.length > 0 && (
        <button
          onClick={handleOpenInPanel}
          className={`w-full px-3 pb-2 text-left transition-colors ${
            isActive ? 'bg-secondary-surface' : 'hover:bg-muted-surface'
          }`}>
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-muted-surface px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-muted-text">
            {previewLines.map((line, i) => (
              <div key={i} className="truncate">
                {line}
              </div>
            ))}
            {lineCount > 3 && (
              <div className="mt-0.5 text-muted-foreground">... +{lineCount - 3} more lines</div>
            )}
          </div>
        </button>
      )}
    </div>
  );
}
