import { Trash2 } from 'lucide-react';

import {
  PYTHON_TASK_DEFAULT_TIMEOUT_SECONDS,
  PYTHON_TASK_TIMEOUT_MAX_SECONDS,
  PYTHON_TASK_TIMEOUT_MIN_SECONDS,
} from '@vnext-forge-studio/vnext-types';

import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { useFormReadOnly } from '../../../ui/FormReadOnlyContext';
// Direct path (not './shared') — component-readonly reuses this form and
// relies on it staying free of store/transport imports.
import { BodyJsonField } from './shared/BodyJsonField.js';
import { pythonTaskConfigRules } from './pythonTaskConfigRules';

type ConfigDraft = Record<string, unknown>;

interface Props {
  config: ConfigDraft;
  onChange: (updater: (draft: ConfigDraft) => void) => void;
}

/**
 * Python Task (type 23, runtime 0.0.103 / vnext-schema 0.0.59): calls a
 * named handler in the domain's Python runtime container. There is no
 * script editor — the handler code lives in the runtime image.
 */
export function PythonTaskForm({ config, onChange }: Props) {
  const readOnly = useFormReadOnly();
  const { errors, legacyKeys, unknownKeys } = pythonTaskConfigRules(config);

  return (
    <div className="space-y-3">
      {legacyKeys.length > 0 ? (
        <Alert variant="warning" className="py-2">
          <AlertTitle>Needs migration</AlertTitle>
          <AlertDescription>{errors.config}</AlertDescription>
          {readOnly ? null : (
            <button
              type="button"
              onClick={() =>
                onChange((d: ConfigDraft) => {
                  for (const key of legacyKeys) delete d[key];
                })
              }
              className="text-destructive-text hover:text-destructive-text/80 mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors">
              <Trash2 className="size-3.5 shrink-0" aria-hidden />
              Remove {legacyKeys.join(' and ')}
            </button>
          )}
        </Alert>
      ) : null}
      {unknownKeys.length > 0 ? (
        <Alert variant="warning" className="py-2">
          <AlertTitle>Unsupported fields</AlertTitle>
          <AlertDescription>
            {unknownKeys.join(', ')} {unknownKeys.length === 1 ? 'is' : 'are'} not part of the Python
            Task config (handler, input, timeoutSeconds) and will fail validation.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Handler"
          required
          hint="Name of a handler registered in the domain’s Python runtime container."
          errorMsg={errors.handler}>
          <Input
            type="text"
            value={typeof config.handler === 'string' ? config.handler : ''}
            onChange={(e) =>
              onChange((d: ConfigDraft) => {
                d.handler = e.target.value || undefined;
              })
            }
            placeholder="risk_score"
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field
          label="Timeout (seconds)"
          hint={`${PYTHON_TASK_TIMEOUT_MIN_SECONDS}–${PYTHON_TASK_TIMEOUT_MAX_SECONDS}; empty uses ${PYTHON_TASK_DEFAULT_TIMEOUT_SECONDS}.`}
          errorMsg={errors.timeoutSeconds}>
          <Input
            type="number"
            min={PYTHON_TASK_TIMEOUT_MIN_SECONDS}
            max={PYTHON_TASK_TIMEOUT_MAX_SECONDS}
            value={config.timeoutSeconds == null ? '' : Number(config.timeoutSeconds)}
            placeholder={String(PYTHON_TASK_DEFAULT_TIMEOUT_SECONDS)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: ConfigDraft) => {
                d.timeoutSeconds = e.target.value !== '' && Number.isFinite(n) ? n : undefined;
              });
            }}
            size="sm"
            inputClassName="text-xs"
          />
        </Field>
      </div>

      <BodyJsonField label="Input (JSON)" value={config.input} configKey="input" onChange={onChange} />
      <p className="text-muted-foreground text-[10px] leading-relaxed">
        Optional JSON passed to the handler. An input mapping can set it at run time with{' '}
        <code className="font-mono">((PythonTask)task).SetInput(…)</code>.
      </p>
    </div>
  );
}
