import { useCallback } from 'react';
import type { ErrorBoundary } from '@vnext-forge-studio/vnext-types';
import { ErrorBoundaryEditor } from './shared/ErrorBoundaryEditor';

interface ErrorBoundaryTabProps {
  state: any;
  updateWorkflow: (updater: (draft: any) => void) => void;
}

export function ErrorBoundaryTab({ state, updateWorkflow }: ErrorBoundaryTabProps) {
  const stateKey = state.key;

  const handleChange = useCallback((eb: ErrorBoundary | undefined) => {
    updateWorkflow((draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return;
      if (eb) {
        s.errorBoundary = eb;
      } else {
        delete s.errorBoundary;
      }
    });
  }, [updateWorkflow, stateKey]);

  return (
    <ErrorBoundaryEditor
      errorBoundary={state.errorBoundary}
      onChange={handleChange}
    />
  );
}
