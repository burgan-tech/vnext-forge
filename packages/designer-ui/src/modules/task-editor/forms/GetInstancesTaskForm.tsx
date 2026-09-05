import { useMemo, useState } from 'react';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { Textarea } from '../../../ui/Textarea';
import { DaprToggleField, HttpSettingsFields, WorkflowRefFields } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

/**
 * Instance columns the runtime accepts in `sort.field` (`InstanceFieldDiscriminator`).
 * `attributes.<path>` is also legal when the master schema marks the field `x-sortable`;
 * that is what the free-text fallback is for.
 */
const SORT_FIELDS = [
  'createdAt', 'modifiedAt', 'completedAt', 'key', 'id', 'status', 'currentState',
  'effectiveState', 'stage', 'createdBy', 'modifiedBy', 'flow',
] as const;

interface ParsedSort { field: string; direction: 'asc' | 'desc' }

/** `{"field":"createdAt","direction":"desc"}` → structured; anything else → null (legacy / free text). */
function parseSort(raw: unknown): ParsedSort | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.field !== 'string' || !rec.field) return null;
    const dir = typeof rec.direction === 'string' ? rec.direction.toLowerCase() : 'asc';
    if (dir !== 'asc' && dir !== 'desc') return null;
    const keys = Object.keys(rec).filter((k) => k !== 'field' && k !== 'direction');
    if (keys.length > 0) return null;
    return { field: rec.field, direction: dir };
  } catch {
    return null;
  }
}

function isLegacyShorthand(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim() !== '' && !raw.trim().startsWith('{');
}

/** Filter must be one JSON object (`{"status":{"eq":"Active"}}`, `{"and":[…]}`); the old string[] form is gone. */
function filterJsonError(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'Filter must be a single JSON object.';
    if (Object.keys(parsed).length === 0) return 'Filter object is empty.';
    return undefined;
  } catch {
    return 'Filter is not valid JSON. The runtime rejects malformed filters with HTTP 400 and the instance goes Faulted.';
  }
}

export function GetInstancesTaskForm({ config, onChange }: Props) {
  const rawSort = config.sort;
  const parsedSort = useMemo(() => parseSort(rawSort), [rawSort]);
  const legacySort = isLegacyShorthand(rawSort);
  // Builder mode when the value is empty or already the single-field JSON
  // form; raw mode when the author asked for it or wrote something the builder
  // cannot represent (an `attributes.*` field, a multi-field sort, or the
  // legacy `-CreatedAt` shorthand).
  const [rawSortMode, setRawSortMode] = useState(false);
  const builderCanRepresent = parsedSort !== null || rawSort === undefined || rawSort === '';
  const sortBuilder = builderCanRepresent && !rawSortMode;
  const builderField = parsedSort?.field ?? 'createdAt';
  const builderDirection = parsedSort?.direction ?? 'desc';

  const setSort = (field: string, direction: 'asc' | 'desc') =>
    onChange((d: any) => { d.sort = JSON.stringify({ field, direction }); });

  // Legacy: the schema used to type `filter` as string[] and the runtime only
  // ever read the first element. Show that element and write back a string.
  const filterArray = Array.isArray(config.filter) ? (config.filter as unknown[]) : null;
  const filterText = typeof config.filter === 'string'
    ? config.filter
    : filterArray && typeof filterArray[0] === 'string' ? filterArray[0] : '';
  const filterError = filterJsonError(filterText);

  return (
    <div className="space-y-3">
      <WorkflowRefFields config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Page">
          <Input type="number" min={1} value={Number(config.page ?? 1)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.page = Number.isFinite(n) && n >= 1 ? n : undefined; });
            }}
            size="sm"
            inputClassName="text-xs" />
        </Field>
        <Field label="Page Size" hint="Runtime caps at 100.">
          <Input type="number" min={1} max={100} value={Number(config.pageSize ?? 10)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.pageSize = Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : undefined; });
            }}
            size="sm"
            inputClassName="text-xs" />
        </Field>
      </div>

      {sortBuilder ? (
        <Field
          label="Sort"
          hint='Sent as {"field":"…","direction":"…"}. Leave the default to sort by createdAt desc.'>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <Select
              value={builderField}
              onChange={(e) => setSort(e.target.value, builderDirection)}
              className="text-xs"
              aria-label="Sort field">
              {SORT_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
            <Select
              value={builderDirection}
              onChange={(e) => setSort(builderField, e.target.value as 'asc' | 'desc')}
              className="text-xs"
              aria-label="Sort direction">
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </Select>
            <button
              type="button"
              className="text-[10px] text-primary-text/65 underline-offset-2 hover:underline"
              title="Switch to a raw JSON sort (e.g. attributes.* fields or multi-field sort)"
              onClick={() => setRawSortMode(true)}>
              raw JSON
            </button>
          </div>
        </Field>
      ) : (
        <Field
          label="Sort (raw JSON)"
          hint='{"field":"createdAt","direction":"desc"} or {"fields":[{"field":"…","direction":"…"},…]}. attributes.* fields need x-sortable in the master schema.'
          errorMsg={legacySort
            ? `"${String(rawSort)}" is the legacy shorthand — the runtime now rejects it and the instance goes Faulted. Use the JSON form.`
            : undefined}>
          <div className="flex items-start gap-2">
            <Input type="text" value={String(rawSort ?? '')}
              onChange={(e) => onChange((d: any) => { d.sort = e.target.value || undefined; })}
              placeholder='{"field":"createdAt","direction":"desc"}'
              size="sm"
              inputClassName="font-mono text-xs" />
            {builderCanRepresent && (
              <button
                type="button"
                className="shrink-0 pt-1 text-[10px] text-primary-text/65 underline-offset-2 hover:underline"
                title="Back to the field / direction builder"
                onClick={() => setRawSortMode(false)}>
                builder
              </button>
            )}
          </div>
        </Field>
      )}

      <Field
        label="Filter"
        hint='One JSON object, e.g. {"status":{"eq":"Active"}} or {"and":[{"status":{"in":["Active","Busy"]}},{"attributes":{"amount":{"gt":500}}}]}. Arrays go in JSON arrays; unsupported operators are rejected (use ge/le, not gte/lte).'
        errorMsg={filterError}>
        {filterArray && filterArray.length > 1 && (
          <p className="text-[10px] text-warning-text">
            This task stores {filterArray.length} filter expressions; the runtime only ever used the first. Saving converts it to a single JSON filter.
          </p>
        )}
        <Textarea
          value={filterText}
          onChange={(e) => onChange((d: any) => { d.filter = e.target.value || undefined; })}
          placeholder='{"status":{"eq":"Active"}}'
          rows={3}
          spellCheck={false}
          className="font-mono text-xs"
        />
      </Field>

      <DaprToggleField value={config.useDapr as boolean | undefined} onChange={onChange} />
      <HttpSettingsFields config={config} onChange={onChange} />
    </div>
  );
}
