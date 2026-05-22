import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { FilterListEditor, normalizeFilterEntries, type FilterEntry } from './FilterListEditor';
import { VNextCardShell } from './VNextCardShell';

interface XLookupCardProps {
  pointer: JsonPointer;
}

interface XLookupValue {
  source: string;
  resultField: string;
  filter: FilterEntry[];
}

const DEFAULT_VALUE = (): XLookupValue => ({
  source: '',
  resultField: '$.response.data',
  filter: [],
});

function toXLookupValue(value: unknown): XLookupValue {
  const fallback = DEFAULT_VALUE();

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  return {
    source: typeof record.source === 'string' ? record.source : '',
    resultField: typeof record.resultField === 'string' ? record.resultField : '',
    filter: normalizeFilterEntries(record.filter),
  };
}

function serialize(value: XLookupValue): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source: value.source,
    resultField: value.resultField,
  };

  if (value.filter.length > 0) {
    out.filter = value.filter;
  }

  return out;
}

/**
 * `x-lookup` enriches the form context with a single object resolved from
 * a remote source when this field is set. Persisted shape:
 * `{ source, resultField, filter?: [{ param, value, required }] }`.
 */
export function XLookupCard({ pointer }: XLookupCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-lookup', DEFAULT_VALUE);
  const current = toXLookupValue(node?.['x-lookup']);

  function update(patch: Partial<XLookupValue>) {
    updateComponent(setKeyword(pointer, 'x-lookup', serialize({ ...current, ...patch })));
  }

  return (
    <VNextCardShell
      xKey="x-lookup"
      title="Lookup"
      purpose="Hydrate a related object from a remote source once this field is set."
      enabled={enabled}
      onToggle={toggle}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Source" hint="URN or URL the lookup is fetched from.">
          <Input
            type="text"
            value={current.source}
            onChange={(event) => update({ source: event.target.value })}
            placeholder="urn:amorphie:func:domain:shared:get-status-detail"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field
          className="sm:col-span-2"
          label="Result field"
          hint="JSONPath to the object exposed to the parent form context.">
          <Input
            type="text"
            value={current.resultField}
            onChange={(event) => update({ resultField: event.target.value })}
            placeholder="$.response.data"
            inputClassName="font-mono text-xs"
          />
        </Field>
      </div>

      <Field label="Filter parameters" hint="Forwarded with the lookup request.">
        <FilterListEditor
          filters={current.filter}
          onChange={(filter) => update({ filter })}
        />
      </Field>
    </VNextCardShell>
  );
}
