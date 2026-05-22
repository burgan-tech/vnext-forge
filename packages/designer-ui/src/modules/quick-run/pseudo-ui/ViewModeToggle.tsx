import { useCallback, useMemo, useState } from 'react';

export type PseudoUiPanelMode = 'preview' | 'json';

const STORAGE_KEY_PREFIX = 'vnext-forge.quickrun.pseudoUiViewPanelMode';

function readStoredMode(storageKey: string): PseudoUiPanelMode {
  if (typeof sessionStorage === 'undefined') return 'preview';
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw === 'json' ? 'json' : 'preview';
  } catch {
    return 'preview';
  }
}

export function usePseudoUiPanelMode(scope = 'default'): [PseudoUiPanelMode, (mode: PseudoUiPanelMode) => void] {
  const storageKey = useMemo(() => `${STORAGE_KEY_PREFIX}.${scope}`, [scope]);
  const [mode, setModeState] = useState<PseudoUiPanelMode>(() => readStoredMode(storageKey));

  const setMode = useCallback(
    (next: PseudoUiPanelMode) => {
      setModeState(next);
      try {
        sessionStorage.setItem(storageKey, next);
      } catch {
        /* ignore quota / privacy mode */
      }
    },
    [storageKey],
  );

  return [mode, setMode];
}

export interface ViewModeToggleProps {
  mode: PseudoUiPanelMode;
  onModeChange: (mode: PseudoUiPanelMode) => void;
}

export function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="View display mode"
      className="inline-flex rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-textCodeBlock-background)] p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'preview'}
        tabIndex={mode === 'preview' ? 0 : -1}
        className={`rounded px-2 py-1 text-[10px] font-medium focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)] motion-reduce:transition-none ${
          mode === 'preview'
            ? 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
            : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
        }`}
        onClick={() => onModeChange('preview')}
      >
        Preview
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'json'}
        tabIndex={mode === 'json' ? 0 : -1}
        className={`rounded px-2 py-1 text-[10px] font-medium focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)] motion-reduce:transition-none ${
          mode === 'json'
            ? 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
            : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
        }`}
        onClick={() => onModeChange('json')}
      >
        JSON
      </button>
    </div>
  );
}
