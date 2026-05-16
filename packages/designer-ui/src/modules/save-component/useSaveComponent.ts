import { useCallback } from 'react';

import { ViewType } from '@vnext-forge-studio/vnext-types';

import { createLogger } from '../../lib/logger/createLogger';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedAutoSave } from '../../hooks/useDebouncedAutoSave';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { normalizeContentForSave } from '../../modules/view-editor/viewContentHelpers';
import { showNotification } from '../../notification/notification-port';
import { saveComponentFile } from './SaveComponentApi';
import { validateComponentBeforeWrite } from './validateBeforeWrite';
import {
  useComponentStore,
  type ComponentValidationError,
} from '../../store/useComponentStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useSettingsStore } from '../../store/useSettingsStore';

const logger = createLogger('save-component/useSaveComponent');

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
    // Every vNext component requires these top-level string fields.
    // We check locally before the RPC so a flaky validate backend can
    // never let a broken file slip to disk.
    const baselineRequired: Array<string> = ['key', 'version', 'domain', 'flow', 'flowVersion'];
    const missingBaseline: ComponentValidationError[] = [];
    for (const field of baselineRequired) {
      const value = (componentJson as Record<string, unknown>)[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        missingBaseline.push({
          path: field,
          message: `Required field "${field}" is empty.`,
        });
      }
    }
    if (missingBaseline.length > 0) {
      useComponentStore.getState().setValidationErrors(missingBaseline);
      const count = missingBaseline.length;
      showNotification({
        kind: 'error',
        message: `Validation failed — ${count} issue${count > 1 ? 's' : ''}`,
        durationMs: 30_000,
        action: {
          label: 'View issues',
          onPress: () => {
            const el = document.getElementById('component-validation-summary');
            el?.scrollIntoView({ behavior: 'smooth' });
            el?.focus();
          },
        },
      });
      logger.warn('Save blocked by baseline required check', {
        fields: missingBaseline.map((e) => e.path),
      });
      return;
    }

    // ── Stale root-property cleanup ─────────────────────────────────────
    // Older editor versions mistakenly wrote attributes-level fields to the
    // root object. Migrate them into attributes (if not already present
    // there) then strip from root so legacy files don't trip
    // additionalProperties checks. We build a cleaned copy for
    // validation + write without pushing spurious undo entries.
    const STALE_ROOT_FIELDS: Record<string, Record<string, string>> = {
      function: { scope: 'scope' },
      extension: { type: 'type', scope: 'scope', definedFlows: 'definedFlows' },
      view: { label: 'labels', displayStrategy: 'display' },
    };
    const fieldMap = STALE_ROOT_FIELDS[componentType ?? ''];
    let cleanedJson: Record<string, unknown> = componentJson;
    if (fieldMap) {
      const hasStale = Object.keys(fieldMap).some((f) => f in componentJson);
      if (hasStale) {
        cleanedJson = { ...componentJson };
        const attrs = { ...((cleanedJson.attributes ?? {}) as Record<string, unknown>) };
        for (const [rootKey, attrKey] of Object.entries(fieldMap)) {
          if (rootKey in cleanedJson) {
            if (!(attrKey in attrs)) {
              attrs[attrKey] = cleanedJson[rootKey];
            }
            delete cleanedJson[rootKey];
          }
        }
        cleanedJson.attributes = attrs;
      }
    }

    // ── Task config key migration ──────────────────────────────────────
    // Older forms wrote trigger-prefixed keys (triggerDomain, triggerFlow,
    // etc.) into attributes.config. The schema expects plain names. Also
    // strip useDapr from types that don't allow it and coerce filter to
    // an array for type 15.
    if (componentType === 'task') {
      const attrs = (cleanedJson.attributes ?? {}) as Record<string, unknown>;
      const cfg = attrs.config as Record<string, unknown> | undefined;
      if (cfg) {
        const TRIGGER_KEY_MAP: Record<string, string> = {
          triggerDomain: 'domain',
          triggerFlow: 'flow',
          triggerVersion: 'version',
          triggerKey: 'key',
          triggerSync: 'sync',
          triggerTags: 'tags',
          triggerInstanceId: 'instanceId',
        };
        let migrated = false;
        for (const [old, correct] of Object.entries(TRIGGER_KEY_MAP)) {
          if (old in cfg) {
            if (!(correct in cfg)) cfg[correct] = cfg[old];
            delete cfg[old];
            migrated = true;
          }
        }
        const taskType = String(attrs.type ?? '');
        const TYPES_WITHOUT_USE_DAPR = new Set(['11', '12', '13', '14']);
        if (TYPES_WITHOUT_USE_DAPR.has(taskType) && 'useDapr' in cfg) {
          delete cfg.useDapr;
          migrated = true;
        }
        if (taskType === '15' && typeof cfg.filter === 'string') {
          cfg.filter = cfg.filter ? [cfg.filter] : [];
          migrated = true;
        }
        if (migrated && cleanedJson === componentJson) {
          cleanedJson = {
            ...componentJson,
            attributes: { ...attrs, config: { ...cfg } },
          };
        }
      }
    }

    // ── View content normalization ─────────────────────────────────────
    // The editor always stores `attributes.content` as a string (Monaco
    // output). For JSON-shaped view types, parse it back to a native
    // object so the saved file has clean JSON — not double-encoded strings.
    if (componentType === 'view') {
      const viewAttrs = (cleanedJson.attributes ?? {}) as Record<string, unknown>;
      if (typeof viewAttrs.content === 'string') {
        const viewType = Number(viewAttrs.type ?? ViewType.Json);
        const normalized = normalizeContentForSave(viewAttrs.content, viewType);
        if (normalized !== viewAttrs.content) {
          if (cleanedJson === componentJson) cleanedJson = { ...componentJson };
          cleanedJson.attributes = { ...viewAttrs, content: normalized };
        }
      }
    }

    // ── Server-side schema validation (vnext-schema via AJV) ─────────────
    if (componentType) {
      const gate = await validateComponentBeforeWrite(cleanedJson, componentType, schemaVersion);
      if (!gate.valid && !gate.skipped) {
        useComponentStore.getState().setValidationErrors(
          gate.errors.map((e) => ({ path: e.path, message: e.message })),
        );
        const count = gate.errors.length;
        showNotification({
          kind: 'error',
          message: `Validation failed — ${count} issue${count > 1 ? 's' : ''}`,
          durationMs: 30_000,
          action: {
            label: 'View issues',
            onPress: () => {
              const el = document.getElementById('component-validation-summary');
              el?.scrollIntoView({ behavior: 'smooth' });
              el?.focus();
            },
          },
        });
        logger.warn('Save blocked by validation', { errors: gate.errors });
        return;
      }
    }

    useComponentStore.getState().clearValidationErrors();

    if (beforeSave) {
      const ok = await beforeSave();
      if (!ok) return;
    }
    await execute(filePath, JSON.stringify(cleanedJson, null, 2));
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
