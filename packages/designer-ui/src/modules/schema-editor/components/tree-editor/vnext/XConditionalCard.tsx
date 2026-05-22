import { Plus, Trash2 } from 'lucide-react';

import { Badge } from '../../../../../ui/Badge';
import { Button } from '../../../../../ui/Button';
import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { cn } from '../../../../../lib/utils/cn';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

interface XConditionalCardProps {
  pointer: JsonPointer;
}

const CONDITIONAL_KINDS = ['showIf', 'hideIf', 'enableIf', 'disableIf'] as const;
type ConditionalKind = (typeof CONDITIONAL_KINDS)[number];

const GROUP_OPS = ['allOf', 'anyOf', 'not'] as const;
type GroupOp = (typeof GROUP_OPS)[number];

const OPERATORS = [
  'equals',
  'notEquals',
  'in',
  'notIn',
  'isEmpty',
  'isNotEmpty',
  'contains',
  'greaterThan',
  'lessThan',
  'greaterThanOrEquals',
  'lessThanOrEquals',
  'startsWith',
  'endsWith',
] as const;
type Operator = (typeof OPERATORS)[number];

const VALUELESS_OPERATORS = new Set<Operator>(['isEmpty', 'isNotEmpty']);
const ARRAY_VALUE_OPERATORS = new Set<Operator>(['in', 'notIn']);

const DEFAULT_VALUE = (): Record<string, unknown> => ({
  showIf: { field: '', operator: 'equals', value: '' },
});

function isLeaf(value: unknown): value is { field: string; operator: string; value?: unknown } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).field === 'string' &&
    typeof (value as Record<string, unknown>).operator === 'string'
  );
}

function getGroupOp(value: unknown): GroupOp | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.allOf)) {
    return 'allOf';
  }

  if (Array.isArray(record.anyOf)) {
    return 'anyOf';
  }

  if (record.not !== undefined) {
    return 'not';
  }

  return null;
}

function defaultLeaf(): Record<string, unknown> {
  return { field: '', operator: 'equals', value: '' };
}

function valueDescription(value: unknown): string {
  if (value === undefined) {
    return 'unset';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '(unprintable value)';
  }
}

/**
 * `x-conditional` controls field visibility / availability with a
 * mini composition DSL: each kind (`showIf`, `hideIf`, `enableIf`,
 * `disableIf`) holds either a single rule (`{ field, operator, value }`)
 * or a logical group (`{ allOf | anyOf | not: ... }`) of expressions.
 * The card renders each kind as a recursive expression editor that
 * mirrors the same nesting semantics used by the workflow runtime.
 */
export function XConditionalCard({ pointer }: XConditionalCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-conditional', DEFAULT_VALUE);

  const stored = node?.['x-conditional'];
  const current: Record<string, unknown> =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  function updateKind(kind: ConditionalKind, next: unknown) {
    const updated: Record<string, unknown> = { ...current };

    if (next === undefined) {
      delete updated[kind];
    } else {
      updated[kind] = next;
    }

    updateComponent(setKeyword(pointer, 'x-conditional', updated));
  }

  return (
    <VNextCardShell
      xKey="x-conditional"
      title="Conditional behavior"
      purpose="Show, hide, enable, or disable this field based on rules over other form values."
      enabled={enabled}
      onToggle={toggle}>
      <div className="space-y-3">
        {CONDITIONAL_KINDS.map((kind) => (
          <KindSection
            key={kind}
            kind={kind}
            value={current[kind]}
            onChange={(next) => updateKind(kind, next)}
          />
        ))}
      </div>
    </VNextCardShell>
  );
}

interface KindSectionProps {
  kind: ConditionalKind;
  value: unknown;
  onChange: (next: unknown) => void;
}

function KindSection({ kind, value, onChange }: KindSectionProps) {
  const isActive = value !== undefined && value !== null;

  return (
    <div className="rounded-md border border-primary-border/60 bg-primary-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
            {kind}
          </Badge>
          {isActive ? null : (
            <span className="text-[10px] text-primary-text/55">disabled</span>
          )}
        </div>

        {isActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-destructive-text"
            aria-label={`Clear ${kind}`}
            onClick={() => onChange(undefined)}>
            <Trash2 size={11} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="success"
            size="sm"
            className="h-6 gap-1 text-[10px]"
            onClick={() => onChange(defaultLeaf())}>
            <Plus size={10} />
            Add rule
          </Button>
        )}
      </div>

      {isActive ? <ExpressionEditor value={value} onChange={onChange} depth={0} /> : null}
    </div>
  );
}

interface ExpressionEditorProps {
  value: unknown;
  onChange: (next: unknown) => void;
  depth: number;
}

function ExpressionEditor({ value, onChange, depth }: ExpressionEditorProps) {
  const groupOp = getGroupOp(value);

  if (groupOp !== null) {
    return <GroupEditor value={value as Record<string, unknown>} op={groupOp} onChange={onChange} depth={depth} />;
  }

  if (isLeaf(value)) {
    return <LeafEditor value={value} onChange={onChange} depth={depth} />;
  }

  return (
    <p className="text-[10px] text-primary-text/55">
      <em>Unsupported expression shape — toggle off and on to reset.</em>
    </p>
  );
}

interface GroupEditorProps {
  value: Record<string, unknown>;
  op: GroupOp;
  onChange: (next: unknown) => void;
  depth: number;
}

function GroupEditor({ value, op, onChange, depth }: GroupEditorProps) {
  const children: unknown[] = (() => {
    if (op === 'not') {
      const inner: unknown = value.not;
      return inner === undefined ? [] : [inner];
    }
    const arr: unknown = value[op];
    return Array.isArray(arr) ? (arr as unknown[]) : [];
  })();

  function commit(nextOp: GroupOp, nextChildren: unknown[]) {
    if (nextOp === 'not') {
      onChange({ not: nextChildren[0] ?? defaultLeaf() });
      return;
    }

    if (nextChildren.length === 0) {
      // Empty group collapses back to a leaf so the user can keep editing.
      onChange(defaultLeaf());
      return;
    }

    onChange({ [nextOp]: nextChildren });
  }

  function changeOp(nextOp: GroupOp) {
    if (nextOp === op) {
      return;
    }

    if (nextOp === 'not') {
      commit('not', children.slice(0, 1));
      return;
    }

    if (op === 'not') {
      commit(nextOp, children);
      return;
    }

    commit(nextOp, children);
  }

  function addChild() {
    if (op === 'not') {
      // `not` accepts exactly one child; ignore duplicates.
      return;
    }
    commit(op, [...children, defaultLeaf()]);
  }

  function removeChild(index: number) {
    commit(op, children.filter((_, i) => i !== index));
  }

  function updateChild(index: number, next: unknown) {
    commit(op, children.map((entry, i) => (i === index ? next : entry)));
  }

  function flattenToLeaf() {
    onChange(defaultLeaf());
  }

  return (
    <div
      className={cn(
        'space-y-2 rounded-md border border-info-border/60 bg-info-muted/15 p-2',
        depth > 0 && 'border-l-2 border-l-info-border',
      )}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="h-7 w-24 text-[11px]"
          value={op}
          onChange={(event) => changeOp(event.target.value as GroupOp)}>
          {GROUP_OPS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <span className="text-[10px] text-primary-text/55">
          {op === 'allOf'
            ? 'all of the following are true'
            : op === 'anyOf'
              ? 'at least one of the following is true'
              : 'the following is NOT true'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-6 gap-1 text-[10px]"
          onClick={flattenToLeaf}>
          Replace with single rule
        </Button>
      </div>

      {children.map((child, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1">
            <ExpressionEditor
              value={child}
              onChange={(next) => updateChild(index, next)}
              depth={depth + 1}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-destructive-text"
            aria-label={`Remove rule ${index + 1}`}
            onClick={() => removeChild(index)}>
            <Trash2 size={11} />
          </Button>
        </div>
      ))}

      {op !== 'not' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="success"
            size="sm"
            className="h-7 gap-1 text-[10px]"
            onClick={addChild}>
            <Plus size={10} />
            Add rule
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 gap-1 text-[10px]"
            onClick={() => commit(op, [...children, { allOf: [defaultLeaf()] }])}>
            <Plus size={10} />
            Add group
          </Button>
        </div>
      ) : children.length === 0 ? (
        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={() => commit(op, [defaultLeaf()])}>
          <Plus size={10} />
          Add rule
        </Button>
      ) : null}
    </div>
  );
}

interface LeafEditorProps {
  value: { field: string; operator: string; value?: unknown };
  onChange: (next: unknown) => void;
  depth: number;
}

function LeafEditor({ value, onChange, depth }: LeafEditorProps) {
  const operator: Operator = (OPERATORS as readonly string[]).includes(value.operator)
    ? (value.operator as Operator)
    : 'equals';
  const isValueless = VALUELESS_OPERATORS.has(operator);
  const isArrayValue = ARRAY_VALUE_OPERATORS.has(operator);

  function commit(patch: Partial<{ field: string; operator: Operator; value: unknown }>) {
    const next: Record<string, unknown> = {
      field: value.field,
      operator,
      ...('value' in value ? { value: value.value } : {}),
      ...patch,
    };

    if (VALUELESS_OPERATORS.has(next.operator as Operator)) {
      delete next.value;
    }

    onChange(next);
  }

  function wrapInGroup() {
    onChange({ allOf: [value, defaultLeaf()] });
  }

  return (
    <div
      className={cn(
        'grid gap-2 rounded-md border border-primary-border/60 bg-primary p-2 sm:grid-cols-[1fr_1fr_2fr_auto]',
        depth > 0 && 'border-l-2 border-l-primary-border-hover',
      )}>
      <Field label="Field">
        <Input
          type="text"
          value={value.field}
          onChange={(event) => commit({ field: event.target.value })}
          placeholder="customerType"
          inputClassName="font-mono text-xs"
        />
      </Field>
      <Field label="Operator">
        <Select
          className="h-8 text-xs"
          value={operator}
          onChange={(event) => commit({ operator: event.target.value as Operator })}>
          {OPERATORS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>

      {isValueless ? (
        <Field label="Value">
          <span className="block py-1.5 text-[10px] text-primary-text/55">
            (none — {operator} is value-less)
          </span>
        </Field>
      ) : isArrayValue ? (
        <Field label="Values" hint="Comma-separated; parsed as JSON literals when possible.">
          <Input
            type="text"
            value={
              Array.isArray(value.value)
                ? value.value
                    .map((entry: unknown) =>
                      typeof entry === 'string' ? entry : JSON.stringify(entry),
                    )
                    .join(', ')
                : ''
            }
            onChange={(event) => {
              const parsed = event.target.value
                .split(',')
                .map((part) => part.trim())
                .filter((part) => part.length > 0)
                .map((part): unknown => {
                  try {
                    return JSON.parse(part);
                  } catch {
                    return part;
                  }
                });

              commit({ value: parsed });
            }}
            placeholder="individual, corporate"
            inputClassName="font-mono text-xs"
          />
        </Field>
      ) : (
        <Field label="Value" hint="JSON literal or plain string.">
          <Input
            type="text"
            value={
              value.value === undefined
                ? ''
                : typeof value.value === 'string'
                  ? value.value
                  : valueDescription(value.value)
            }
            onChange={(event) => {
              const raw = event.target.value;

              if (raw === '') {
                commit({ value: '' });
                return;
              }

              try {
                commit({ value: JSON.parse(raw) });
              } catch {
                commit({ value: raw });
              }
            }}
            placeholder="individual"
            inputClassName="font-mono text-xs"
          />
        </Field>
      )}

      <div className="flex items-end gap-1 pb-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={wrapInGroup}
          title="Wrap this rule in a logical group">
          <Plus size={10} />
          Group
        </Button>
      </div>
    </div>
  );
}
