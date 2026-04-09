import { create } from 'zustand';

interface RuntimeState {
  connected: boolean;
  runtimeUrl: string;
  healthStatus: 'unknown' | 'healthy' | 'unhealthy';
  lastHealthCheck: string | null;

  setRuntimeUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  setHealthStatus: (status: 'unknown' | 'healthy' | 'unhealthy') => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  connected: false,
  runtimeUrl: 'http://localhost:4201',
  healthStatus: 'unknown',
  lastHealthCheck: null,

  setRuntimeUrl: (runtimeUrl) => set({ runtimeUrl }),
  setConnected: (connected) => set({ connected }),
  setHealthStatus: (healthStatus) => set({ healthStatus, lastHealthCheck: new Date().toISOString() }),
}));
