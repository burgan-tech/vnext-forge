import type { HostEditorCapabilities } from './HostEditorCapabilities.js';

const defaultWebCapabilities: HostEditorCapabilities = {
  csharpLspUsesPostMessageTransport: false,
  postMessageAllowedOrigins: [],
};

let current: HostEditorCapabilities = defaultWebCapabilities;

export function setHostEditorCapabilities(next: HostEditorCapabilities): void {
  current = next;
}

export function getHostEditorCapabilities(): HostEditorCapabilities {
  return current;
}
