import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '../lib/logger/createLogger';

const logger = createLogger('hooks/useDebouncedAutoSave');

const DEFAULT_DELAY_MS = 3000;

export interface UseDebouncedAutoSaveOptions {
  isDirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
  enabled: boolean;
  /**
   * Opaque value that changes on every content edit (e.g. a counter or object
   * reference). The debounce timer resets whenever this value changes, ensuring
   * 3 s from the *last* edit rather than from the first.
   */
  changeSignal: unknown;
  delayMs?: number;
}

export interface UseDebouncedAutoSaveResult {
  /** `true` while the debounce timer is ticking (dirty + waiting to save). */
  autoSavePending: boolean;
  /** `true` after an auto-triggered save succeeds (reset on next edit). */
  autoSaved: boolean;
  cancelAutoSave: () => void;
}

/**
 * Debounced auto-save hook. When `enabled` and `isDirty`, schedules a
 * background save after `delayMs` (default 3 000 ms). Each new dirty change
 * resets the timer. Manual saves should call `cancelAutoSave()` to avoid a
 * redundant write.
 */
export function useDebouncedAutoSave({
  isDirty,
  saving,
  save,
  enabled,
  changeSignal,
  delayMs = DEFAULT_DELAY_MS,
}: UseDebouncedAutoSaveOptions): UseDebouncedAutoSaveResult {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const [autoSavePending, setAutoSavePending] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAutoSavePending(false);
  }, []);

  const cancelAutoSave = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    if (!enabled || !isDirty || saving) {
      clearTimer();
      return;
    }

    setAutoSaved(false);
    setAutoSavePending(true);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setAutoSavePending(false);

      saveRef.current().then(
        () => {
          setAutoSaved(true);
        },
        (err) => {
          logger.error('Auto-save failed', err);
        },
      );
    }, delayMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- changeSignal is intentionally opaque
  }, [enabled, isDirty, saving, delayMs, clearTimer, changeSignal]);

  useEffect(() => {
    if (isDirty) {
      setAutoSaved(false);
    }
  }, [isDirty]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { autoSavePending, autoSaved, cancelAutoSave };
}
