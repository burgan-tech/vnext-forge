import { Sliders } from 'lucide-react';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { MetadataSection } from './MetadataSection';

const inputClass =
  'w-full px-2.5 py-1.5 text-xs font-mono border border-border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle';

/**
 * Pure collapse logic for `attributes.config.functionCache.ttlSeconds`.
 * Given the current `attributes.config` (or `undefined`) and the raw input
 * value, returns the next value of `attributes.config` — the updated config
 * object, or `undefined` when it has fully collapsed (empty/invalid input
 * prunes `ttlSeconds`, then `functionCache` if empty, then `config` itself).
 *
 * Exported (rather than kept inline) so the prune-to-undefined invariants
 * can be unit-tested without rendering the component or the store.
 */
export function applyFunctionCacheTtlChange(
  config: Record<string, unknown> | undefined,
  raw: string,
): Record<string, unknown> | undefined {
  const n = Number(raw);
  const nextConfig = { ...(config ?? {}) };
  const functionCache = { ...((nextConfig.functionCache ?? {}) as Record<string, unknown>) };

  if (raw === '' || !Number.isFinite(n) || n < 1) {
    delete functionCache.ttlSeconds;
  } else {
    functionCache.ttlSeconds = n;
  }

  if (Object.keys(functionCache).length === 0) {
    delete nextConfig.functionCache;
  } else {
    nextConfig.functionCache = functionCache;
  }

  return Object.keys(nextConfig).length === 0 ? undefined : nextConfig;
}

export function WorkflowConfigSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const ttl = attrs.config?.functionCache?.ttlSeconds;

  const updateTtl = (raw: string) => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes) draft.attributes = {};
      const nextConfig = applyFunctionCacheTtlChange(draft.attributes.config, raw);
      if (nextConfig === undefined) {
        delete draft.attributes.config;
      } else {
        draft.attributes.config = nextConfig;
      }
    });
  };

  return (
    <MetadataSection
      title="Workflow Config"
      icon={<Sliders size={13} />}
      defaultOpen={!!attrs.config}>
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Flow-level configuration for this workflow.
        </p>
        <div>
          <label className="text-muted-foreground text-[10px] font-semibold">
            Function Cache TTL (seconds)
          </label>
          <input
            type="number"
            min={1}
            value={ttl ?? ''}
            onChange={(e) => updateTtl(e.target.value)}
            className={inputClass}
            aria-label="Function Cache TTL (seconds)"
          />
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
            Cache TTL for this workflow's built-in function responses (data, view,
            schema). Empty → host default.
          </p>
        </div>
      </div>
    </MetadataSection>
  );
}
