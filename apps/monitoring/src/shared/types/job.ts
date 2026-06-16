export type JobStatus = 'Active' | 'Processed' | 'Failed' | 'Cancelled';
export type ScheduleType = 'delay' | 'cron';

export interface InstanceJob {
  jobName: string;
  jobId: string;
  instanceId: string;
  instanceKey: string;
  workflow: string;
  transition: string;
  scheduleType: ScheduleType;
  schedule: string;
  scheduledFor: string;
  isActive: boolean;
  status: JobStatus;
  retryCount: number;
  lastError?: string;
  traceparent: string;
  createdAt: string;
  firedAt?: string;
}
