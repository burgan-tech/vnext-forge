import { ResourceReference } from './state';

/**
 * Shared `scripts` sub-object that decorates every script-carrying
 * shape — `mapping` / `rule` / `timer` on transitions/tasks/views, and
 * the workflow-level `attributes.scripts`. Pairs runtime imports
 * (CSX helpers + .NET assemblies) with the engine that resolves them.
 *
 * `helpers` always refers to `sys-mappings` components; `flow` is
 * constrained at the schema level but kept as a plain string in this
 * type so existing `ResourceReference` consumers can reuse helpers
 * lists without a discriminated union.
 */
export interface ScriptsConfig {
  helpers: ResourceReference[];
  allowedAssemblies: string[];
}
