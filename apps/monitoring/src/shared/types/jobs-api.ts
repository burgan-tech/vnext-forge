// --- §6.1 / §6.2 Jobs ---

export interface JobItem {
  jobId: string;
  name: string;
  instanceId: string;
  flow: string;
  domain: string;
  isActive: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface JobsResponse {
  jobs: JobItem[];
}

// --- §7.1 Runtime Config ---

export interface RuntimeConfigResponse {
  runtimeVersion: string;
  monitor: {
    redisMode: string;
    tracingEnabled: boolean;
    metricsEnabled: boolean;
    vaultEnabled: boolean;
  };
}

// --- §8.1 Health Check ---

export interface HealthEntry {
  name: string;
  status: 'Healthy' | 'Degraded' | 'Unhealthy';
  durationMs: number;
  description: string | null;
  exception: string | null;
  data: Record<string, unknown>;
}

export interface HealthDetailResponse {
  status: 'Healthy' | 'Degraded' | 'Unhealthy';
  totalDurationMs: number;
  entries: HealthEntry[];
}

// --- §5.1 Domain-Scope Function Definitions ---

export interface FunctionRoleGrant {
  role: string;
  grant: 'allow' | 'deny';
}

export interface DomainFunctionItem {
  key: string;
  version: string;
  scope: string;
  taskCount: number;
  roles: FunctionRoleGrant[];
}

export interface DomainFunctionsResponse {
  items: DomainFunctionItem[];
  total: number;
}
