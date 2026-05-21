import { Plus, Trash2 } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { LocalizedTextMapEditor, type LocalizedTextMap } from '../../../../../ui/LocalizedTextMapEditor';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

interface XErrorMessagesCardProps {
  pointer: JsonPointer;
}

type ErrorMessageMap = Record<string, LocalizedTextMap>;

const KNOWN_CONSTRAINT_KEYS = [
  'required',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'pattern',
  'format',
  'enum',
  'const',
  'type',
  'minItems',
  'maxItems',
  'uniqueItems',
  'multipleOf',
] as const;

const DEFAULT_VALUE = (): ErrorMessageMap => ({ required: { en: '' } });

function toErrorMessageMap(value: unknown): ErrorMessageMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const out: ErrorMessageMap = {};

  for (const [constraint, labels] of Object.entries(value)) {
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
      continue;
    }

    const map: LocalizedTextMap = {};

    for (const [lang, text] of Object.entries(labels as Record<string, unknown>)) {
      if (typeof text === 'string') {
        map[lang] = text;
      }
    }

    out[constraint] = map;
  }

  return out;
}

/**
 * `x-errorMessages` provides per-language override messages for individual
 * validation rules. Persisted shape:
 * `{ [constraintKey]: { [lang]: string } }`. The card lets the user pick
 * which constraint keys to override and edit per-language text below.
 */
export function XErrorMessagesCard({ pointer }: XErrorMessagesCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-errorMessages', DEFAULT_VALUE);
  const map = toErrorMessageMap(node?.['x-errorMessages']);

  const activeKeys = Object.keys(map);
  const availableKeys = KNOWN_CONSTRAINT_KEYS.filter((key) => !activeKeys.includes(key));

  function setEntries(next: ErrorMessageMap) {
    if (Object.keys(next).length === 0) {
      updateComponent(setKeyword(pointer, 'x-errorMessages', undefined));
      // Re-enable seed on next toggle.
      return;
    }

    updateComponent(setKeyword(pointer, 'x-errorMessages', next));
  }

  function addConstraint(constraint: string) {
    if (!constraint || activeKeys.includes(constraint)) {
      return;
    }

    setEntries({ ...map, [constraint]: { en: '' } });
  }

  function removeConstraint(constraint: string) {
    const next = { ...map };
    delete next[constraint];
    setEntries(next);
  }

  function updateLabels(constraint: string, labels: LocalizedTextMap) {
    setEntries({ ...map, [constraint]: labels });
  }

  return (
    <VNextCardShell
      xKey="x-errorMessages"
      title="Validation error messages"
      purpose="Override the default error message of one or more validation rules, per language."
      enabled={enabled}
      onToggle={toggle}>
      <div className="space-y-3">
        {activeKeys.length === 0 ? (
          <p className="text-[10px] text-primary-text/55">
            No overrides yet. Pick a constraint below to add one.
          </p>
        ) : (
          activeKeys.map((constraint) => (
            <div
              key={constraint}
              className="rounded-md border border-primary-border/60 bg-primary-muted/40 p-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="font-mono text-[11px] font-semibold">{constraint}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 text-destructive-text"
                  aria-label={`Remove ${constraint} override`}
                  onClick={() => removeConstraint(constraint)}>
                  <Trash2 size={11} />
                </Button>
              </div>
              <LocalizedTextMapEditor
                label="Messages"
                value={map[constraint] ?? {}}
                onChange={(next) => updateLabels(constraint, next)}
              />
            </div>
          ))
        )}

        {availableKeys.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <Select
              className="h-8 text-xs"
              defaultValue=""
              onChange={(event) => {
                addConstraint(event.target.value);
                event.target.value = '';
              }}>
              <option value="" disabled>
                Add constraint override…
              </option>
              {availableKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
            <Plus aria-hidden size={11} className="text-primary-text/40" />
          </div>
        ) : null}
      </div>
    </VNextCardShell>
  );
}
