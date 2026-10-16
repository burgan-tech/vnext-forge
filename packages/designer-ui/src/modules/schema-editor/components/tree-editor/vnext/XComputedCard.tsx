import { Plus, Trash2 } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { Field } from '../../../../../ui/Field';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { COMPUTED_ARITHMETIC_OPS, computedIssues, computedSiblings } from '../../../model/computedRules';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { ExpressionEditor, defaultLeaf } from './XConditionalCard';
import { CommaListInput } from './CommaListInput';
import { VNextCardShell } from './VNextCardShell';

type Computed = Record<string, unknown>;
type Operation = Record<string, unknown>;

const DEFAULT_VALUE = (): Computed => ({ evaluatedBy: 'runtime', fallback: { join: { fields: [] } } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function operationKind(operation: Operation): 'join' | 'arithmetic' {
  return operation.arithmetic !== undefined ? 'arithmetic' : 'join';
}

function operationBody(operation: Operation): Record<string, unknown> {
  const body = operation[operationKind(operation)];
  return isRecord(body) ? body : {};
}


/** Switches a case / fallback between join and arithmetic, keeping `when` and the fields. */
export function withOperationKind(operation: Operation, kind: 'join' | 'arithmetic'): Operation {
  const fields = operationBody(operation).fields;
  const rest = { ...operation };
  delete rest.join;
  delete rest.arithmetic;
  const keep = Array.isArray(fields) ? fields : [];
  return kind === 'join' ? { ...rest, join: { fields: keep } } : { ...rest, arithmetic: { op: 'add', fields: keep } };
}

interface OperationEditorProps {
  operation: Operation;
  siblings: string[];
  onChange: (next: Operation) => void;
}

function OperationEditor({ operation, siblings, onChange }: OperationEditorProps) {
  const kind = operationKind(operation);
  const body = operationBody(operation);
  const setBody = (patch: Record<string, unknown>) => {
    const next = { ...body, ...patch };
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
    onChange({ ...operation, [kind]: next });
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
      <Field label="Operation">
        <Select
          className="h-8 text-xs"
          value={kind}
          onChange={(event) => onChange(withOperationKind(operation, event.target.value as 'join' | 'arithmetic'))}>
          <option value="join">join</option>
          <option value="arithmetic">arithmetic</option>
        </Select>
      </Field>
      <Field
        label="Fields"
        hint={`Sibling properties, comma-separated${siblings.length > 0 ? `: ${siblings.join(', ')}` : ''}.`}>
        <CommaListInput
          value={Array.isArray(body.fields) ? body.fields : []}
          onCommit={(fields) => setBody({ fields })}
          placeholder={kind === 'join' ? 'firstName, lastName' : 'principal, interest'}
        />
      </Field>
      {kind === 'join' ? (
        <Field label="Separator" hint="Default: one space.">
          <Input
            type="text"
            value={typeof body.separator === 'string' ? body.separator : ''}
            onChange={(event) => setBody({ separator: event.target.value === '' ? undefined : event.target.value })}
            inputClassName="font-mono text-xs"
          />
        </Field>
      ) : (
        <Field label="Op">
          <Select
            className="h-8 text-xs"
            value={typeof body.op === 'string' ? body.op : 'add'}
            onChange={(event) => setBody({ op: event.target.value })}>
            {COMPUTED_ARITHMETIC_OPS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}

/**
 * `x-computed` (vnext-schema 0.0.56 / runtime 0.0.100): a derived, never-stored
 * field built from sibling properties. The first case whose `when` matches
 * wins; `fallback` applies otherwise. `evaluatedBy: runtime` is computed on
 * every read surface; `client` leaves it to the client.
 */
export function XComputedCard({ pointer }: { pointer: JsonPointer }) {
  const readOnly = useFormReadOnly();
  const { node } = useSchemaNode(pointer);
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-computed', DEFAULT_VALUE);

  const value: Computed = isRecord(node?.['x-computed']) ? (node['x-computed'] as Computed) : {};
  const cases = Array.isArray(value.cases) ? (value.cases.filter(isRecord) as Operation[]) : [];
  const fallback = isRecord(value.fallback) ? (value.fallback as Operation) : undefined;
  const siblings = computedSiblings(componentJson, pointer);
  const issues = enabled ? computedIssues(componentJson, pointer) : [];

  const write = (patch: Partial<Computed>) => {
    const next: Computed = { ...value, ...patch };
    for (const [key, v] of Object.entries(patch)) if (v === undefined) delete next[key];
    updateComponent(setKeyword(pointer, 'x-computed', next));
  };
  const setCases = (next: Operation[]) => write({ cases: next.length > 0 ? next : undefined });

  return (
    <VNextCardShell
      xKey="x-computed"
      title="Computed value"
      purpose="Derive this field from sibling properties (join or arithmetic). It is never stored. Master schemas only."
      enabled={enabled}
      onToggle={toggle}
      error={
        issues.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : undefined
      }>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Evaluated by">
          <Select
            className="h-8 text-xs"
            value={typeof value.evaluatedBy === 'string' ? value.evaluatedBy : ''}
            onChange={(event) => write({ evaluatedBy: event.target.value || undefined })}>
            {value.evaluatedBy !== 'runtime' && value.evaluatedBy !== 'client' ? (
              <option value="">{typeof value.evaluatedBy === 'string' ? `${value.evaluatedBy} (invalid)` : 'not set'}</option>
            ) : null}
            <option value="runtime">runtime — on every read</option>
            <option value="client">client — computed by the client</option>
          </Select>
        </Field>
        <Field label="When unresolved">
          <Select
            className="h-8 text-xs"
            value={value.whenAbsent === 'null' ? 'null' : 'empty'}
            onChange={(event) => write({ whenAbsent: event.target.value === 'null' ? 'null' : undefined })}>
            <option value="empty">empty string (default)</option>
            <option value="null">null</option>
          </Select>
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-primary-text/75">Cases (first match wins)</p>
        {cases.map((entry, index) => (
          <div key={index} className="space-y-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold">Case {index + 1}</span>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-destructive-text"
                  aria-label={`Remove case ${index + 1}`}
                  onClick={() => setCases(cases.filter((_, i) => i !== index))}>
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
            {entry.when !== undefined ? (
              <Field label="When">
                <ExpressionEditor
                  value={entry.when}
                  depth={0}
                  onChange={(when) => setCases(cases.map((c, i) => (i === index ? { ...c, when } : c)))}
                />
              </Field>
            ) : !readOnly ? (
              <button
                type="button"
                className="cursor-pointer text-[10px] font-semibold underline"
                onClick={() => setCases(cases.map((c, i) => (i === index ? { ...c, when: defaultLeaf() } : c)))}>
                Add a condition
              </button>
            ) : null}
            <OperationEditor
              operation={entry}
              siblings={siblings}
              onChange={(next) => setCases(cases.map((c, i) => (i === index ? next : c)))}
            />
          </div>
        ))}
        {!readOnly && (
          <Button
            type="button"
            variant="success"
            size="sm"
            className="h-7 gap-1 text-[10px]"
            onClick={() => setCases([...cases, { when: defaultLeaf(), join: { fields: [] } }])}>
            <Plus size={10} />
            Add case
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-primary-text/75">Fallback</p>
        {fallback ? (
          <div className="space-y-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2">
            <OperationEditor operation={fallback} siblings={siblings} onChange={(next) => write({ fallback: next })} />
            {!readOnly && (
              <button
                type="button"
                className="cursor-pointer text-[10px] font-semibold text-destructive-text underline"
                onClick={() => write({ fallback: undefined })}>
                Remove fallback
              </button>
            )}
          </div>
        ) : !readOnly ? (
          <button
            type="button"
            className="cursor-pointer text-[10px] font-semibold underline"
            onClick={() => write({ fallback: { join: { fields: [] } } })}>
            Add a fallback
          </button>
        ) : null}
      </div>
    </VNextCardShell>
  );
}
