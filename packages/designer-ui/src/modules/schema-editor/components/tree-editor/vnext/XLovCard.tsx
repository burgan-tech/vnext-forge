import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
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

interface XLovValue {
  source: string;
  valueField: string;
  displayField: string;
  filter: FilterEntry[];
}

const DEFAULT_VALUE = (): XLovValue => ({
  source: '',
  valueField: '$.response.data.code',
  displayField: '$.response.data.name',
  filter: [],
});

function toXLovValue(value: unknown): XLovValue {
  const fallback = DEFAULT_VALUE();

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  return {
    source: typeof record.source === 'string' ? record.source : '',
    valueField: typeof record.valueField === 'string' ? record.valueField : '',
    displayField: typeof record.displayField === 'string' ? record.displayField : '',
    filter: normalizeFilterEntries(record.filter),
  };
}

function serialize(value: XLovValue): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source: value.source,
    valueField: value.valueField,
    displayField: value.displayField,
  };

  if (value.filter.length > 0) {
    out.filter = value.filter;
  }

  return out;
}

/**
 * `x-lov` (List of Values) attaches a remote data source to a field for
 * dropdown population. Persisted shape:
 * `{ source, valueField, displayField, filter?: [{ param, value, required }] }`.
 */
export function XLovCard({ pointer }: XLovCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-lov', DEFAULT_VALUE);
  const current = toXLovValue(node?.['x-lov']);

  function update(patch: Partial<XLovValue>) {
    updateComponent(setKeyword(pointer, 'x-lov', serialize({ ...current, ...patch })));
  }

  return (
    <VNextCardShell
      xKey="x-lov"
      title="List of Values"
      purpose="Populate a dropdown from a remote source; optionally filtered by other form fields."
      enabled={enabled}
      onToggle={toggle}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Source" hint="URN or URL the LOV is fetched from.">
          <Input
            type="text"
            value={current.source}
            onChange={(event) => update({ source: event.target.value })}
            placeholder="urn:amorphie:func:domain:shared:get-statuses"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field label="Value field" hint="JSONPath to the option value.">
          <Input
            type="text"
            value={current.valueField}
            onChange={(event) => update({ valueField: event.target.value })}
            placeholder="$.response.data.code"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field label="Display field" hint="JSONPath to the option label.">
          <Input
            type="text"
            value={current.displayField}
            onChange={(event) => update({ displayField: event.target.value })}
            placeholder="$.response.data.name"
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
