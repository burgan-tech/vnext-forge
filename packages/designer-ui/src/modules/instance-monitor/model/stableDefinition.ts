import type { MonitorDefinition } from '../types';

const signatures = new WeakMap<MonitorDefinition, string>();
const keys = new WeakMap<MonitorDefinition, string>();

/** Content signature of a definition (source, version, workflow and diagram); cached per object. */
export function definitionSignature(definition: MonitorDefinition): string {
  let signature = signatures.get(definition);
  if (signature === undefined) {
    signature = JSON.stringify([definition.source, definition.localVersion ?? '', definition.vm, definition.diagram]);
    signatures.set(definition, signature);
  }
  return signature;
}

/**
 * Keeps the previous definition object when a refresh re-read the same content, so the canvas
 * does not rebuild its nodes (a rebuild drops the node positions it already laid out).
 */
export function stableDefinition(prev: MonitorDefinition | undefined, next: MonitorDefinition): MonitorDefinition {
  if (!prev || prev === next) return next;
  return definitionSignature(prev) === definitionSignature(next) ? prev : next;
}

/** Short React key for a definition: changes exactly when its content does. */
export function definitionKey(definition: MonitorDefinition): string {
  let key = keys.get(definition);
  if (key === undefined) {
    const signature = definitionSignature(definition);
    let hash = 5381;
    for (let i = 0; i < signature.length; i++) hash = ((hash << 5) + hash + signature.charCodeAt(i)) | 0;
    key = `${signature.length.toString(36)}-${(hash >>> 0).toString(36)}`;
    keys.set(definition, key);
  }
  return key;
}
