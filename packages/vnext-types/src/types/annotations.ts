/**
 * Key-value annotations on a transition or the workflow timeout. Pure
 * passthrough metadata for client UI context; the runtime does not interpret
 * values. Use namespaced keys, e.g. `ui/priority`. The schema also accepts
 * `null`.
 */
export type Annotations = Record<string, string>;
