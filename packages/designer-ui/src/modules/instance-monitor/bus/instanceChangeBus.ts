export interface InstanceChangeEvent {
  domain: string;
  instanceId: string;
  status?: string;
  state?: string;
}

type Listener = (event: InstanceChangeEvent) => void;

const listeners = new Set<Listener>();
let relay: Listener | null = null;
const CHANNEL = 'vnext-forge-instance';
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  channel?.addEventListener('message', (e: MessageEvent<InstanceChangeEvent>) => deliver(e.data));
  return channel;
}

function deliver(event: InstanceChangeEvent): void {
  for (const l of [...listeners]) {
    try {
      l(event);
    } catch {
      /* one bad listener must not stop the others */
    }
  }
}

/**
 * "This instance changed" — Quick Run publishes, the Instance Monitor
 * listens. Local subscribers get it synchronously, other browser tabs via
 * BroadcastChannel, and other webviews through the host relay.
 */
export function publishInstanceChange(event: InstanceChangeEvent, options: { relay?: boolean } = {}): void {
  deliver(event);
  try {
    getChannel()?.postMessage(event);
  } catch {
    /* channel closed */
  }
  if (options.relay !== false) relay?.(event);
}

export function subscribeInstanceChanges(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Host shells forward events to other webviews (extension) — null to unregister. */
export function registerInstanceChangeRelay(next: Listener | null): void {
  relay = next;
}
