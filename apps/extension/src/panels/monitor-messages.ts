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

export interface OpenQuickRunRequest {
  /** Present only when the webview sent a well-formed id; the panel is revealed either way. */
  instanceId?: string;
}

/** `monitor:open-quickrun` from a monitor panel; the host already knows which workflow. A bad id is dropped, not rejected. */
export function parseOpenQuickRunFromMonitorMessage(raw: unknown): OpenQuickRunRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const msg = raw as Record<string, unknown>;
  if (msg.type !== 'monitor:open-quickrun') return null;
  const instanceId = typeof msg.instanceId === 'string' ? msg.instanceId : '';
  return ID_PATTERN.test(instanceId) ? { instanceId } : {};
}

export interface InstanceChangedEvent {
  domain: string;
  instanceId: string;
  status?: string;
  state?: string;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : undefined;
}

/** `quickrun:instance-changed` from a Quick Run panel, relayed to monitor panels of the same domain. */
export function parseInstanceChangedMessage(raw: unknown): InstanceChangedEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const msg = raw as Record<string, unknown>;
  if (msg.type !== 'quickrun:instance-changed') return null;
  const domain = typeof msg.domain === 'string' ? msg.domain : '';
  if (domain.length === 0 || domain.length > 100) return null;
  const instanceId = typeof msg.instanceId === 'string' ? msg.instanceId : '';
  if (!ID_PATTERN.test(instanceId)) return null;
  const status = optionalString(msg.status);
  const state = optionalString(msg.state);
  return { domain, instanceId, ...(status ? { status } : {}), ...(state ? { state } : {}) };
}
