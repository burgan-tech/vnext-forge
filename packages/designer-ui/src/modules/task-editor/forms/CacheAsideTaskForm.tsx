import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { Checkbox } from '../../../ui/Checkbox';
import { DynamicExpressoField, type DynamicExpressoValue } from '../../../ui/DynamicExpressoField';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { isMappingCodeRef, type MappingCode } from '@vnext-forge-studio/vnext-types';

interface Props {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

export function CacheAsideTaskForm({ config, onChange }: Props) {
  const sourceTask = (config.sourceTask as Record<string, unknown> | undefined) ?? {};
  const sourceMappingCode = (config.sourceMapping as { code?: unknown } | undefined)?.code;
  const sourceMappingIsRef = isMappingCodeRef(sourceMappingCode as MappingCode['code']);
  const setSource = (field: string, value: string) =>
    onChange((d: any) => {
      const s = (d.sourceTask as Record<string, unknown>) ?? {};
      s[field] = value || undefined;
      d.sourceTask = s;
    });

  return (
    <div className="space-y-3">
      <Field label="Cache Key" hint="Static key. Optional — may be derived by the key expression below.">
        <Input
          type="text"
          value={String(config.key || '')}
          onChange={(e) => onChange((d: any) => { d.key = e.target.value || undefined; })}
          size="sm"
          inputClassName="font-mono text-xs"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Store Name" hint="Empty → runtime DAPR_STATE_STORE_NAME.">
          <Input
            type="text"
            value={String(config.storeName || '')}
            onChange={(e) => onChange((d: any) => { d.storeName = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <Field label="TTL (seconds)" hint="Absent or 0 → no expiry.">
          <Input
            type="number"
            min={0}
            value={config.ttlInSeconds == null ? '' : Number(config.ttlInSeconds)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => {
                d.ttlInSeconds = e.target.value !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
              });
            }}
            size="sm"
            inputClassName="text-xs"
          />
        </Field>
      </div>

      <Field label="Consistency">
        <Select
          value={String(config.consistency || '')}
          onChange={(e) => onChange((d: any) => { d.consistency = e.target.value || undefined; })}
          className="text-xs">
          <option value="">Default</option>
          <option value="Eventual">Eventual</option>
          <option value="Strong">Strong</option>
        </Select>
      </Field>

      <div className="rounded-md border border-border p-3 space-y-2">
        <span className="text-xs font-semibold text-primary-text/75">Source Task</span>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key" required>
            <Input
              type="text"
              value={String(sourceTask.key || '')}
              onChange={(e) => setSource('key', e.target.value)}
              size="sm"
              inputClassName="font-mono text-xs"
            />
          </Field>
          <Field label="Domain" required>
            <Input
              type="text"
              value={String(sourceTask.domain || '')}
              onChange={(e) => setSource('domain', e.target.value)}
              size="sm"
              inputClassName="font-mono text-xs"
            />
          </Field>
          <Field label="Flow" hint="Defaults to sys-tasks.">
            <Input
              type="text"
              value={String(sourceTask.flow || '')}
              onChange={(e) => setSource('flow', e.target.value)}
              placeholder="sys-tasks"
              size="sm"
              inputClassName="font-mono text-xs"
            />
          </Field>
          <Field label="Version" required>
            <Input
              type="text"
              value={String(sourceTask.version || '')}
              onChange={(e) => setSource('version', e.target.value)}
              size="sm"
              inputClassName="font-mono text-xs"
            />
          </Field>
        </div>
      </div>

      <Field label="Source Mapping" hint="Optional C# mapping applied to the raw source result before caching (stored inline).">
        {sourceMappingIsRef ? (
          <div className="rounded-md border border-border p-2 text-xs text-muted-foreground">
            References a sys-mappings component. Edit via the raw JSON editor.
          </div>
        ) : (
          <JsonCodeField
            language="csharp"
            value={typeof sourceMappingCode === 'string' ? sourceMappingCode : ''}
            onChange={(code) => onChange((d: any) => { d.sourceMapping = code ? { code, encoding: 'NAT' } : undefined; })}
          />
        )}
      </Field>

      <DynamicExpressoField
        label="Key Expression"
        hint="Optional Dynamic Expresso expression whose string result overrides the cache key."
        value={config.keyExpression as DynamicExpressoValue | undefined}
        onChange={(next) => onChange((d: any) => { d.keyExpression = next; })}
      />

      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={config.bypassOnCacheError !== false}
          onCheckedChange={(value) => onChange((d: any) => { d.bypassOnCacheError = value === true ? undefined : false; })}
        />
        Bypass on cache error (fall back to the source task)
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={config.forceRefresh === true}
          onCheckedChange={(value) => onChange((d: any) => { d.forceRefresh = value === true ? true : undefined; })}
        />
        Force refresh (always run source, overwrite cache)
      </label>
    </div>
  );
}
