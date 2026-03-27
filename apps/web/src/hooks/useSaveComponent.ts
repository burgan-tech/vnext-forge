import { useEffect, useCallback } from 'react';
import { useComponentStore } from '../stores/component-store';

export function useSaveComponent() {
  const { componentJson, filePath, isDirty, markClean } = useComponentStore();

  const save = useCallback(async () => {
    if (!componentJson || !filePath || !isDirty) return;

    try {
      await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          content: JSON.stringify(componentJson, null, 2),
        }),
      });
      markClean();
    } catch (err) {
      console.error('Failed to save component:', err);
    }
  }, [componentJson, filePath, isDirty, markClean]);

  // Listen for Cmd+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  return { save, isDirty };
}
