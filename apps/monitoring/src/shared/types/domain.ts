export interface Domain {
  name: string;
  displayName: string;
  env: string;
  engineVersion: string;
}

export interface InstanceStats {
  total: number;
  active: number;
  busy: number;
  completed: number;
  faulted: number;
  passive: number;
}

export interface ComponentCounts {
  flows: number;
  tasks: number;
  functions: number;
  views: number;
  extensions: number;
  schemas: number;
  mappings: number;
  total: number;
}

export interface StatsTimePoint {
  label: string;
  active: number;
  completed: number;
  faulted: number;
}
