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
  suspended: number;
  terminated: number;
}

export interface ComponentCounts {
  workflows: number;
  tasks: number;
  functions: number;
  views: number;
  extensions: number;
}

export interface StatsTimePoint {
  label: string;
  active: number;
  completed: number;
  faulted: number;
}
