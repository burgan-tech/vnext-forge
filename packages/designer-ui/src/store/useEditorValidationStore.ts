import { create } from 'zustand';

export interface EditorMarkerIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface EditorMarkerCounts {
  errors: number;
  warnings: number;
  infos: number;
}

function summarizeMarkers(markers: EditorMarkerIssue[]): EditorMarkerCounts {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const m of markers) {
    if (m.severity === 'error') errors++;
    else if (m.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos };
}

interface EditorValidationState {
  activeFileMarkers: EditorMarkerIssue[];
  activeFilePath: string | null;
  markerCounts: EditorMarkerCounts;
  setActiveFileMarkers: (filePath: string, markers: EditorMarkerIssue[]) => void;
  clearMarkers: () => void;
}

export const useEditorValidationStore = create<EditorValidationState>((set) => ({
  activeFileMarkers: [],
  activeFilePath: null,
  markerCounts: { errors: 0, warnings: 0, infos: 0 },
  setActiveFileMarkers: (filePath, markers) =>
    set({
      activeFilePath: filePath,
      activeFileMarkers: markers,
      markerCounts: summarizeMarkers(markers),
    }),
  clearMarkers: () =>
    set({
      activeFileMarkers: [],
      activeFilePath: null,
      markerCounts: { errors: 0, warnings: 0, infos: 0 },
    }),
}));
