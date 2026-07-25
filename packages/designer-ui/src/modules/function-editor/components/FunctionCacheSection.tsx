import { Section } from '../../../ui/Section';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { Checkbox } from '../../../ui/Checkbox';
import { TagEditor } from '../../../ui/TagEditor';
import { DynamicExpressoField, type DynamicExpressoValue } from '../../../ui/DynamicExpressoField';

interface FunctionCacheSectionProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

function mutateCache(
  onChange: FunctionCacheSectionProps['onChange'],
  fn: (cache: Record<string, unknown>) => void,
) {
  onChange((draft) => {
    const a = (draft.attributes ?? {}) as Record<string, unknown>;
    const cache = { ...((a.cache ?? {}) as Record<string, unknown>) };
    fn(cache);
    const hasAny = Object.values(cache).some((v) => v !== undefined);
    a.cache = hasAny ? cache : undefined;
    draft.attributes = a;
  });
}

export function FunctionCacheSection({ json, onChange }: FunctionCacheSectionProps) {
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const cache = (attrs.cache ?? {}) as Record<string, unknown>;

  return (
    <Section
      title="Cache"
      description="Optional read-through cache for this function."
      collapsible
      defaultOpen={!!attrs.cache}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key" hint="Static cache key (used when no key expression).">
            <Input
              type="text"
              value={String(cache.key || '')}
              onChange={(e) => mutateCache(onChange, (c) => { c.key = e.target.value || undefined; })}
              size="sm"
              inputClassName="font-mono text-xs"
            />
          </Field>
          <Field label="Store Name" hint="Empty → runtime DAPR_STATE_STORE_NAME.">
            <Input
              type="text"
              value={String(cache.storeName || '')}
              onChange={(e) => mutateCache(onChange, (c) => { c.storeName = e.target.value || undefined; })}
              size="sm"
              inputClassName="font-mono text-xs"
            />
          </Field>
        </div>

        <DynamicExpressoField
          label="Key Expression"
          hint="Dynamic Expresso expression computing the cache key. Takes precedence over Key."
          value={cache.keyExpression as DynamicExpressoValue | undefined}
          onChange={(next) => mutateCache(onChange, (c) => { c.keyExpression = next; })}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="TTL (seconds)" hint="Null / non-positive → no expiry.">
            <Input
              type="number"
              min={1}
              value={cache.ttlInSeconds == null ? '' : Number(cache.ttlInSeconds)}
              onChange={(e) => {
                const n = Number(e.target.value);
                mutateCache(onChange, (c) => {
                  c.ttlInSeconds = e.target.value !== '' && Number.isFinite(n) && n >= 1 ? n : undefined;
                });
              }}
              size="sm"
              inputClassName="text-xs"
            />
          </Field>
          <Field label="Consistency">
            <Select
              value={String(cache.consistency || '')}
              onChange={(e) => mutateCache(onChange, (c) => { c.consistency = e.target.value || undefined; })}
              className="text-xs">
              <option value="">Default</option>
              <option value="Eventual">Eventual</option>
              <option value="Strong">Strong</option>
            </Select>
          </Field>
        </div>

        <Field label="Vary By Headers" hint="Exact request-header names that vary the cached result.">
          <TagEditor
            tags={(cache.varyByHeaders as string[] | undefined) ?? []}
            onChange={(tags) => mutateCache(onChange, (c) => { c.varyByHeaders = tags.length > 0 ? tags : undefined; })}
            placeholder="Add header name"
          />
        </Field>
        <Field label="Vary By Header Prefixes" hint="Request-header name prefixes that vary the result.">
          <TagEditor
            tags={(cache.varyByHeaderPrefixes as string[] | undefined) ?? []}
            onChange={(tags) => mutateCache(onChange, (c) => { c.varyByHeaderPrefixes = tags.length > 0 ? tags : undefined; })}
            placeholder="Add header prefix"
          />
        </Field>

        <Field label="Generation Key" hint="State key holding the cache generation stamp (namespace invalidation).">
          <Input
            type="text"
            value={String(cache.generationKey || '')}
            onChange={(e) => mutateCache(onChange, (c) => { c.generationKey = e.target.value || undefined; })}
            size="sm"
            inputClassName="font-mono text-xs"
          />
        </Field>
        <DynamicExpressoField
          label="Generation Key Expression"
          hint="Dynamic Expresso expression resolving the generation-stamp state key. Takes precedence over Generation Key."
          value={cache.generationKeyExpression as DynamicExpressoValue | undefined}
          onChange={(next) => mutateCache(onChange, (c) => { c.generationKeyExpression = next; })}
        />

        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={cache.bypassOnCacheError !== false}
            onCheckedChange={(v) => mutateCache(onChange, (c) => { c.bypassOnCacheError = v === true ? undefined : false; })}
          />
          Bypass on cache error (fall back to executing the function)
        </label>
      </div>
    </Section>
  );
}
