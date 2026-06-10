import { useCallback, useMemo, useState } from 'react';
import { encodeToBase64 } from '../../../modules/code-editor/editor/Base64Handler';
import {
  decodeScriptCode,
  formatScriptCodeRef,
  isScriptCodeRef,
  type ScriptCodeRef,
} from '../../../modules/code-editor/editor/ScriptCodec';
import { generateTemplate, type TemplateType } from '../../../modules/code-editor/editor/CsxTemplates';
import { useScriptPanelStore, type ActiveScript } from '../../../modules/code-editor/ScriptPanelStore';
import { useEditorPanelsStore } from '../../../store/useEditorPanelsStore';
import { useScriptTaskChrome } from '../../../modules/task-editor/ScriptTaskChromeContext';
import { resolveWorkflowScriptAbsolutePath } from '../../../modules/code-editor/createWorkflowScriptFile';
import type { CsxTaskType } from '../../../modules/code-editor/editor/CsxContext';
import type { ScriptCode } from '../../../modules/code-editor/CodeEditorTypes';
import { ChooseExistingVnextComponentDialog } from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import { Code2, Link as LinkIcon, Plus, Trash2, ExternalLink } from 'lucide-react';

/* ────────────── Types ────────────── */

export type { ScriptCode, TemplateType };

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
  /**
   * When `false`, hide the "Reference existing mapping" action and the
   * REF preview card branch. The Mapping editor itself sets this since
   * sys-mappings cannot self-reference.
   */
  allowRefEncoding?: boolean;
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
  allowRefEncoding = true,
}: CsxEditorFieldProps) {
  const { openScript, activeScript } = useScriptPanelStore();
  const { setScriptPanelOpen } = useEditorPanelsStore();
  const chrome = useScriptTaskChrome();
  const hostOpen = chrome?.onOpenScriptFileInHost;
  const scriptDir = chrome?.scriptDirectoryPath;
  const [refPickerOpen, setRefPickerOpen] = useState(false);

  const isRef = value?.encoding === 'REF' && isScriptCodeRef(value.code);
  const refValue: ScriptCodeRef | null = isRef ? (value!.code as ScriptCodeRef) : null;

  const handlePickRef = useCallback(
    (component: { key: string; version?: string; flow: string }) => {
      setRefPickerOpen(false);
      const next: ScriptCode = {
        location: '',
        encoding: 'REF',
        code: {
          key: component.key,
          version: component.version ?? '1.0.0',
          flow: 'sys-mappings',
        },
      };
      onChange(next);
    },
    [onChange],
  );

  const decoded = useMemo(() => {
    if (!value?.code) return '';
    return decodeScriptCode(value.code, value.encoding);
  }, [value?.code, value?.encoding]);

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

  const handleCreateNat = useCallback(() => {
    const { code } = generateTemplate(templateType, contextName, taskType);
    const newValue: ScriptCode = {
      location: '',
      code,
      encoding: 'NAT',
    };
    onChange(newValue);

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
    // Prefer opening the script directly in the host editor:
    //   - Extension shell: native VS Code tab via `host:open-workspace-file`
    //   - Web shell: full-page Monaco route via React Router navigate
    // The host adapter is injected through `ScriptTaskChromeProvider`. We
    // can only resolve a file path when the script is stored as a B64
    // *file* (encoding !== 'NAT') with a non-empty location AND the
    // provider supplied a base directory. Inline-native scripts (`NAT`)
    // have no on-disk path and must fall back to the in-app bottom drawer.
    if (
      hostOpen &&
      scriptDir &&
      value.encoding !== 'NAT' &&
      value.location &&
      value.location.trim().length > 0
    ) {
      hostOpen(resolveWorkflowScriptAbsolutePath(scriptDir, value.location.trim()));
      return;
    }
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
    hostOpen,
    scriptDir,
  ]);

  // Check if this exact script is currently open in the bottom panel
  const isActive =
    activeScript?.stateKey === stateKey &&
    activeScript?.listField === listField &&
    activeScript?.index === index &&
    activeScript?.scriptField === scriptField;

  /* ── No script → Create buttons ── */
  if (!value || !value.code) {
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleCreate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary-border px-3 py-2.5 text-[12px] font-semibold text-primary-text transition-all hover:border-primary-border-hover hover:bg-primary-hover">
          <Plus size={14} />
          <span>Create {label || templateType}</span>
        </button>
        <button
          type="button"
          onClick={handleCreateNat}
          title="Script stored inline in the workflow file (not a separate .csx path)"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary-border hover:text-primary-text">
          <Code2 size={12} />
          <span>Create Native Script</span>
        </button>
        {allowRefEncoding && (
          <button
            type="button"
            onClick={() => setRefPickerOpen(true)}
            title="Reuse an existing sys-mappings component by reference"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary-border hover:text-primary-text">
            <LinkIcon size={12} />
            <span>Reference existing mapping</span>
          </button>
        )}
        <ChooseExistingVnextComponentDialog
          open={refPickerOpen}
          onOpenChange={setRefPickerOpen}
          category="mappings"
          onSelect={handlePickRef}
          title="Choose a mapping to reference"
        />
      </div>
    );
  }

  /* ── REF encoding → compact ref card with picker / remove ── */
  if (isRef && refValue) {
    return (
      <div className="border-border-subtle bg-surface/40 mt-0.5 rounded-lg border">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="bg-primary-muted text-primary-icon flex size-5 shrink-0 items-center justify-center rounded-md">
            <LinkIcon size={11} className="text-current" />
          </div>
          <span className="flex-1 truncate font-mono text-[11px] font-medium text-foreground">
            {formatScriptCodeRef(refValue)}
          </span>
          <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            REF
          </span>
          <button
            type="button"
            onClick={() => setRefPickerOpen(true)}
            className="text-secondary-text hover:bg-secondary-muted shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors"
            title="Change referenced mapping">
            Change
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-muted-icon hover:bg-destructive-surface hover:text-destructive-text shrink-0 rounded-md p-1 transition-all"
              title="Remove reference">
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <ChooseExistingVnextComponentDialog
          open={refPickerOpen}
          onOpenChange={setRefPickerOpen}
          category="mappings"
          onSelect={handlePickRef}
          title="Choose a mapping to reference"
        />
      </div>
    );
  }

  /* ── Script exists → Compact preview card ── */
  return (
    <div
      className={`mt-0.5 border-t transition-colors ${isActive ? 'border-secondary-border bg-secondary-surface' : 'border-border-subtle'}`}>
      {/* Header — click to open in panel (div+role: inner Remove must stay a real <button> — no nested buttons) */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpenInPanel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpenInPanel();
          }
        }}
        className={`group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors ${
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
        <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {value.encoding === 'NAT' ? 'NAT' : 'B64'}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
          {lineCount}L
        </span>
        {onRemove && (
          <button
            type="button"
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
      </div>

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
