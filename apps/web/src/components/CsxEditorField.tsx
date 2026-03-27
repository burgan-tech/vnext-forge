import { useCallback, useMemo } from 'react';
import { encodeToBase64, decodeFromBase64 } from '../editor/Base64Handler';
import { generateTemplate, type TemplateType } from '../editor/csx-templates';
import { useScriptPanelStore, type ActiveScript } from '../stores/script-panel-store';
import { useUIStore } from '../stores/ui-store';
import type { CsxTaskType } from '../editor/csx-context';
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
  }, [templateType, contextName, taskType, onChange, stateKey, listField, index, scriptField, label, openScript, setScriptPanelOpen]);

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
  }, [value, stateKey, listField, index, scriptField, templateType, label, contextName, taskType, openScript, setScriptPanelOpen]);

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
          className="flex items-center gap-2 text-[12px] text-indigo-500 hover:text-indigo-600 px-3 py-2.5 border border-dashed border-indigo-200/60 rounded-xl hover:border-indigo-400/60 hover:bg-indigo-50/50 transition-all w-full justify-center font-semibold"
        >
          <Plus size={14} />
          <span>Create {label || templateType}</span>
        </button>
      </div>
    );
  }

  /* ── Script exists → Compact preview card ── */
  return (
    <div className={`border-t mt-0.5 transition-colors ${isActive ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}>
      {/* Header — click to open in panel */}
      <button
        onClick={handleOpenInPanel}
        className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors group ${
          isActive ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'
        }`}
      >
        <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${
          isActive ? 'bg-indigo-500/20' : 'bg-indigo-500/10'
        }`}>
          <Code2 size={11} className="text-indigo-500" />
        </div>
        <span className="text-[11px] text-slate-600 flex-1 truncate font-mono font-medium">
          {value.location || label || templateType}
        </span>
        <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
          {lineCount}L
        </span>
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md shrink-0 transition-all"
            title="Remove script"
          >
            <Trash2 size={12} />
          </button>
        )}
        <ExternalLink
          size={12}
          className={`shrink-0 transition-all ${
            isActive ? 'text-indigo-500' : 'text-slate-300 group-hover:text-indigo-400'
          }`}
        />
      </button>

      {/* Code preview (readonly, 3 lines max) */}
      {previewLines.length > 0 && (
        <button
          onClick={handleOpenInPanel}
          className={`w-full text-left px-3 pb-2 transition-colors ${
            isActive ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'
          }`}
        >
          <div className="rounded-lg bg-slate-50/80 border border-slate-100 px-2.5 py-1.5 font-mono text-[10px] text-slate-500 leading-relaxed overflow-hidden">
            {previewLines.map((line, i) => (
              <div key={i} className="truncate">{line}</div>
            ))}
            {lineCount > 3 && (
              <div className="text-slate-300 mt-0.5">... +{lineCount - 3} more lines</div>
            )}
          </div>
        </button>
      )}
    </div>
  );
}
