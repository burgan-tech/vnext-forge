import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { FilterListEditor, normalizeFilterEntries, type FilterEntry } from './FilterListEditor';
import { VNextCardShell } from './VNextCardShell';

interface XLovCardProps {
  pointer: JsonPointer;
}

type LovMode = 'source' | 'items';

interface XLovValue {
  mode: LovMode;
  /** URN of the data source function (`mode: 'source'`). */
  source: string;
  /** `$instance.<path>` / `$form.<path>` array already in scope (`mode: 'items'`). */
  items: string;
  valueField: string;
  displayField: string;
  imageField: string;
  filter: FilterEntry[];
}

const DEFAULT_VALUE = (): Record<string, unknown> => ({
  source: '',
  valueField: '$.response.data.code',
  displayField: '$.response.data.name',
});

export function toXLovValue(value: unknown): XLovValue {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const text = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : '');
  return {
    mode: typeof record.items === 'string' && typeof record.source !== 'string' ? 'items' : 'source',
    source: text('source'),
    items: text('items'),
    valueField: text('valueField'),
    displayField: text('displayField'),
    imageField: text('imageField'),
    filter: normalizeFilterEntries(record.filter),
  };
}

/** Exactly one of `source` / `items` (vnext-schema 0.0.56 `oneOf`). */
export function serializeXLov(value: XLovValue): Record<string, unknown> {
  const out: Record<string, unknown> =
    value.mode === 'items' ? { items: value.items } : { source: value.source };
  out.valueField = value.valueField;
  out.displayField = value.displayField;
  if (value.imageField !== '') out.imageField = value.imageField;
  if (value.filter.length > 0) out.filter = value.filter;
  return out;
}

/** Switching modes resets the field paths to that mode's shape. */
export function withLovMode(value: XLovValue, mode: LovMode): XLovValue {
  if (mode === value.mode) return value;
  return mode === 'items'
    ? { ...value, mode, valueField: '', displayField: '', imageField: '' }
    : { ...value, mode, valueField: '$.response.data.code', displayField: '$.response.data.name', imageField: '' };
}

/**
 * `x-lov` (List of Values) fills a dropdown from a data SOURCE (a function
 * URN, fetched) or from ITEMS already in scope (`$instance.` / `$form.` array,
 * no request) — exactly one of the two. With items, the field paths are plain
 * property names in one element, or empty for the element itself.
 */
export function XLovCard({ pointer }: XLovCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-lov', DEFAULT_VALUE);
  const current = toXLovValue(node?.['x-lov']);
  const items = current.mode === 'items';

  function write(next: XLovValue) {
    updateComponent(setKeyword(pointer, 'x-lov', serializeXLov(next)));
  }

  function update(patch: Partial<XLovValue>) {
    write({ ...current, ...patch });
  }

  return (
    <VNextCardShell
      xKey="x-lov"
      title="List of Values"
      purpose="Populate a dropdown from a data source or from a list already in the form or instance."
      enabled={enabled}
      onToggle={toggle}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Options from">
          <Select
            className="h-8 text-xs"
            value={current.mode}
            onChange={(event) => write(withLovMode(current, event.target.value as LovMode))}>
            <option value="source">Data source (fetched)</option>
            <option value="items">Items in scope (no request)</option>
          </Select>
        </Field>
        {items ? (
          <Field label="Items" hint="$instance.<path> or $form.<path> naming an array.">
            <Input
              type="text"
              value={current.items}
              onChange={(event) => update({ items: event.target.value })}
              placeholder="$instance.accounts"
              inputClassName="font-mono text-xs"
            />
          </Field>
        ) : (
          <Field label="Source" hint="Function URN; may interpolate {{$form.x}}.">
            <Input
              type="text"
              value={current.source}
              onChange={(event) => update({ source: event.target.value })}
              placeholder="urn:vnext:func:domain:shared:get-statuses"
              inputClassName="font-mono text-xs"
            />
          </Field>
        )}
        <Field label="Value field" hint={items ? 'Property name in one item; empty = the item.' : 'JSONPath to the option value.'}>
          <Input
            type="text"
            value={current.valueField}
            onChange={(event) => update({ valueField: event.target.value })}
            placeholder={items ? 'id' : '$.response.data.code'}
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field label="Display field" hint={items ? 'Property name in one item; empty = the item.' : 'JSONPath to the option label.'}>
          <Input
            type="text"
            value={current.displayField}
            onChange={(event) => update({ displayField: event.target.value })}
            placeholder={items ? 'name' : '$.response.data.name'}
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field className="sm:col-span-2" label="Image field" hint="Optional image per option, same path shape.">
          <Input
            type="text"
            value={current.imageField}
            onChange={(event) => update({ imageField: event.target.value })}
            inputClassName="font-mono text-xs"
          />
        </Field>
      </div>

      <Field label="Filter parameters" hint="Forwarded with the request when their values are available.">
        <FilterListEditor
          filters={current.filter}
          onChange={(filter) => update({ filter })}
        />
      </Field>
    </VNextCardShell>
  );
}
