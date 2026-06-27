import type { JobItem } from '@monitoring/shared/types/jobs-api'

export interface JobRow {
  jobId: string
  name: string
  flow: string
  instanceId: string
  isActive: boolean
  createdAt: string
  modifiedAt: string
}

export function normalizeJobs(jobs: JobItem[]): JobRow[] {
  return jobs.map((j) => ({
    jobId: j.jobId,
    name: j.name,
    flow: j.flow,
    instanceId: j.instanceId,
    isActive: j.isActive,
    createdAt: j.createdAt,
    modifiedAt: j.modifiedAt,
  }))
}
