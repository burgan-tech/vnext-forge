import { create } from 'zustand';
import type { TemplateType } from '../editor/csx-templates';
import type { CsxTaskType } from '../editor/csx-context';
import type { ScriptCode } from '../components/CsxEditorField';

export interface ActiveScript {
  /** Which state this script belongs to */
  stateKey: string;
  /** 'onEntries' | 'onExits' for task mappings, 'transitions' for transition scripts */
  listField: string;
  /** Index within the list */
  index: number;
  /** Which script field: 'mapping' | 'rule' | 'condition' | 'timer' */
  scriptField: string;
  /** Current script value */
  value: ScriptCode;
  /** Template type for snippets/completions */
  templateType: TemplateType;
  /** Display label */
  label: string;
  /** Context name for template generation */
  contextName?: string;
  /** Task type for context-aware completions */
  taskType?: CsxTaskType;
}

interface ScriptPanelState {
  activeScript: ActiveScript | null;

  openScript: (script: ActiveScript) => void;
  closeScript: () => void;
  updateScriptValue: (value: ScriptCode) => void;
}

export const useScriptPanelStore = create<ScriptPanelState>((set) => ({
  activeScript: null,

  openScript: (script) => set({ activeScript: script }),

  closeScript: () => set({ activeScript: null }),

  updateScriptValue: (value) =>
    set((s) => {
      if (!s.activeScript) return s;
      return { activeScript: { ...s.activeScript, value } };
    }),
}));
