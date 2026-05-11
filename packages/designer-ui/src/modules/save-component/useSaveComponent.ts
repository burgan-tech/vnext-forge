import { useCallback } from 'react';
import { isFailure } from '@vnext-forge-studio/app-contracts';

import { callApi } from '../../api/client';
import { createLogger } from '../../lib/logger/createLogger';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedAutoSave } from '../../hooks/useDebouncedAutoSave';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { showNotification } from '../../notification/notification-port';
import { saveComponentFile } from './SaveComponentApi';
import {
  useComponentStore,
  type ComponentValidationError,
} from '../../store/useComponentStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useSettingsStore } from '../../store/useSettingsStore';

const logger = createLogger('save-component/useSaveComponent');

/**
 * Server-side validation envelope (shape returned by `validate/component`).
 * The error/warning entries align with `ComponentValidationError` exported
 * by `useComponentStore`, but we type the wire field as a superset
 * (server can include an extra `params` field that we don't surface).
 */
interface ComponentValidationResult {
  valid: boolean;
  errors: Array<ComponentValidationError & { params?: Record<string, unknown> }>;
  warnings: Array<ComponentValidationError & { params?: Record<string, unknown> }>;
}

export interface UseSaveComponentOptions {
  /**
   * Component type (e.g. `'task'`, `'workflow'`, `'schema'`, `'function'`,
   * `'extension'`, `'view'`) used for schema validation. When supplied,
   * `save()` runs `validate/component` against the project's pinned
   * `schemaVersion` before writing — if validation fails we surface the
   * first error as a notification and cancel the save (so the user
   * doesn't end up with a broken file on disk).
   */
  componentType?: string;
  /** Return false to cancel the save. Runs after schema validation. */
  beforeSave?: () => Promise<boolean>;
  /** Called after a successful write and `markClean()`. */
  afterSaveSuccess?: () => void;
}

export function useSaveComponent(options?: UseSaveComponentOptions) {
  const componentJson = useComponentStore((state) => state.componentJson);
  const filePath = useComponentStore((state) => state.filePath);
  const isDirty = useComponentStore((state) => state.isDirty);
  const markClean = useComponentStore((state) => state.markClean);
  const autoSaveEnabled = useSettingsStore((state) => state.autoSaveEnabled);
  const schemaVersion = useProjectStore((state) => state.vnextConfig?.schemaVersion);
  const componentType = options?.componentType;
  const beforeSave = options?.beforeSave;
  const afterSaveSuccess = options?.afterSaveSuccess;

  const saveFile = useCallback(
    (nextFilePath: string, content: string) => saveComponentFile(nextFilePath, content),
    [],
  );

  const { execute, loading, error } = useAsync(saveFile, {
    showNotificationOnSuccess: true,
    showNotificationOnError: false,
    successMessage: 'Component saved.',
    errorMessage: 'Component could not be saved.',
    onSuccess: async () => {
      markClean();
      afterSaveSuccess?.();
    },
    onError: async (saveError) => {
      logger.error('Failed to save component', saveError);
    },
  });

  const save = useCallback(async () => {
    if (!componentJson || !filePath || !isDirty) return;

    // ── Client-side baseline guard ───────────────────────────────────────
    // Every vNext component requires `key`, `version`, `domain` at the
    // top level. We check these here in addition to the server call so
    // a flaky/missing validate backend can never let a broken file
    // slip to disk. The check runs first because it's free.
    const baselineRequired: Array<string> = ['key', 'version', 'domain'];
    const missingBaseline: ComponentValidationError[] = [];
    for (const key of baselineRequired) {
      const value = (componentJson as Record<string, unknown>)[key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        missingBaseline.push({
          path: key,
          message: `Required field "${key}" is empty.`,
        });
      }
    }
    if (missingBaseline.length > 0) {
      useComponentStore.getState().setValidationErrors(missingBaseline);
      const first = missingBaseline[0];
      const extra =
        missingBaseline.length > 1 ? ` (+${missingBaseline.length - 1} more)` : '';
      showNotification({
        kind: 'error',
        message: `Cannot save — ${first.message}${extra}`,
      });
      logger.warn('Save blocked by baseline required check', {
        fields: missingBaseline.map((e) => e.path),
      });
      return;
    }

    // Server-side schema validation before writing to disk. We call
    // `validate/component` against the project's pinned schemaVersion;
    // if anything fails (required field missing, wrong format, ...) we
    // surface the first error as a notification, write the full error
    // list to the component store (so forms can red-border the matching
    // inputs), and abort the save so the user doesn't end up with a
    // broken file on disk.
    if (componentType) {
      try {
        const result = await callApi<ComponentValidationResult>({
          method: 'validate/component',
          params: {
            content: componentJson,
            type: componentType,
            ...(schemaVersion ? { schemaVersion } : {}),
          },
        });
        if (!isFailure(result) && result.data && !result.data.valid) {
          const errors = result.data.errors ?? [];
          useComponentStore.getState().setValidationErrors(
            errors.map((e) => ({ path: e.path ?? '', message: e.message })),
          );
          const firstError = errors[0];
          const errorCount = errors.length;
          const summary = firstError
            ? `${firstError.path || componentType}: ${firstError.message}` +
              (errorCount > 1 ? ` (+${errorCount - 1} more)` : '')
            : 'Validation failed';
          showNotification({
            kind: 'error',
            message: `Cannot save — ${summary}`,
          });
          logger.warn('Save blocked by validation', { errors });
          return;
        }
      } catch (err) {
        // Validation infra error (network etc.) — log but allow save to
        // proceed; the server-side write path will still catch hard
        // failures, and we don't want a transient validate outage to
        // strand the user's edits.
        logger.warn('Pre-save validation failed; allowing save', err);
      }
    }

    // Validation passed — make sure no stale errors linger.
    useComponentStore.getState().clearValidationErrors();

    if (beforeSave) {
      const ok = await beforeSave();
      if (!ok) return;
    }
    await execute(filePath, JSON.stringify(componentJson, null, 2));
  }, [beforeSave, componentJson, componentType, execute, filePath, isDirty, schemaVersion]);

  const { autoSavePending, autoSaved, cancelAutoSave } = useDebouncedAutoSave({
    isDirty,
    saving: loading,
    save,
    enabled: autoSaveEnabled,
    changeSignal: componentJson,
  });

  const manualSave = useCallback(async () => {
    cancelAutoSave();
    await save();
  }, [cancelAutoSave, save]);

  useRegisterGlobalSaveShortcut(manualSave);

  return { save: manualSave, isDirty, saving: loading, saveError: error, autoSavePending, autoSaved };
}
