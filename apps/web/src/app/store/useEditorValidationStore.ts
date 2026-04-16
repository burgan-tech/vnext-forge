import { create } from 'zustand';

export interface EditorMarkerIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

interface EditorValidationState {
  activeFileMarkers: EditorMarkerIssue[];
  activeFilePath: string | null;
  setActiveFileMarkers: (filePath: string, markers: EditorMarkerIssue[]) => void;
  clearMarkers: () => void;
}

export const useEditorValidationStore = create<EditorValidationState>((set) => ({
  activeFileMarkers: [],
  activeFilePath: null,
  setActiveFileMarkers: (filePath, markers) =>
    set({ activeFilePath: filePath, activeFileMarkers: markers }),
  clearMarkers: () => set({ activeFileMarkers: [], activeFilePath: null }),
}));
