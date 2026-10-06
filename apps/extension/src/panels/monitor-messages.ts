/**
 * Webview → host messages for the Instance Monitor. Kept free of `vscode` so
 * they can be unit tested. The instance id is webview input that ends up in a
 * runtime URL path, so only id-like values pass.
 */
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export interface OpenMonitorRequest {
  instanceId: string;
  instanceKey?: string;
}

/** `quickrun:open-monitor` from a Quick Run panel; workflow identity comes from that panel's context. */
export function parseOpenMonitorMessage(raw: unknown): OpenMonitorRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const msg = raw as Record<string, unknown>;
  if (msg.type !== 'quickrun:open-monitor') return null;
  const instanceId = typeof msg.instanceId === 'string' ? msg.instanceId : '';
  if (!ID_PATTERN.test(instanceId)) return null;
  const instanceKey = typeof msg.instanceKey === 'string' && msg.instanceKey.length > 0 ? msg.instanceKey.slice(0, 200) : undefined;
  return { instanceId, ...(instanceKey ? { instanceKey } : {}) };
}

/** `monitor:open-quickrun` from a monitor panel; the host already knows which workflow. */
export function isOpenQuickRunFromMonitorMessage(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'monitor:open-quickrun';
}
