import { create } from 'zustand';

type RuntimeHealthStatus = 'unknown' | 'healthy' | 'unhealthy';

interface RuntimeHealthSnapshot {
  connected: boolean;
  healthStatus: RuntimeHealthStatus;
  lastHealthCheck: string;
}

interface RuntimeState {
  connected: boolean;
  runtimeUrl: string;
  healthStatus: RuntimeHealthStatus;
  lastHealthCheck: string | null;
  setRuntimeUrl: (url: string) => void;
  syncRuntimeHealth: (snapshot: RuntimeHealthSnapshot) => void;
  markRuntimeDisconnected: (checkedAt?: string) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  connected: false,
  runtimeUrl: 'http://localhost:4201',
  healthStatus: 'unknown',
  lastHealthCheck: null,
  setRuntimeUrl: (runtimeUrl) => set({ runtimeUrl }),
  syncRuntimeHealth: ({ connected, healthStatus, lastHealthCheck }) =>
    set({
      connected,
      healthStatus,
      lastHealthCheck,
    }),
  markRuntimeDisconnected: (checkedAt = new Date().toISOString()) =>
    set({
      connected: false,
      healthStatus: 'unhealthy',
      lastHealthCheck: checkedAt,
    }),
}));
