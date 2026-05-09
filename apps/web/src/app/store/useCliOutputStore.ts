import { create } from 'zustand';

export interface CliOutputEntry {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timestamp: number;
}

interface CliOutputState {
  runningCommand: string | null;
  lastOutput: CliOutputEntry | null;
  popoverOpen: boolean;

  setRunning: (command: string) => void;
  setOutput: (entry: Omit<CliOutputEntry, 'timestamp'>) => void;
  clearOutput: () => void;
  setPopoverOpen: (open: boolean) => void;
}

export const useCliOutputStore = create<CliOutputState>((set) => ({
  runningCommand: null,
  lastOutput: null,
  popoverOpen: false,

  setRunning: (command) => set({ runningCommand: command, lastOutput: null, popoverOpen: false }),

  setOutput: (entry) =>
    set({
      runningCommand: null,
      lastOutput: { ...entry, timestamp: Date.now() },
      popoverOpen: entry.exitCode !== 0,
    }),

  clearOutput: () => set({ lastOutput: null, popoverOpen: false }),
  setPopoverOpen: (popoverOpen) => set({ popoverOpen }),
}));
