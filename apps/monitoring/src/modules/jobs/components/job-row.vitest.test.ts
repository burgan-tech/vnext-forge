import { describe, it, expect } from 'vitest'
import { normalizeJobs } from './job-row'
import type { JobItem } from '@monitoring/shared/types/jobs-api'

const sample: JobItem = {
  jobId: 'job-001',
  name: 'payment-reminder-timer',
  instanceId: '8e298c72-457c-4cd2-b3f2-e94fd5bf5a41',
  flow: 'lifecycle-transitions-test-workflow',
  domain: 'core',
  isActive: true,
  createdAt: '2026-06-10T08:00:00Z',
  modifiedAt: '2026-06-10T09:00:00Z',
}

describe('normalizeJobs', () => {
  it('maps JobItem fields to JobRow and drops domain', () => {
    expect(normalizeJobs([sample])).toEqual([
      {
        jobId: 'job-001',
        name: 'payment-reminder-timer',
        flow: 'lifecycle-transitions-test-workflow',
        instanceId: '8e298c72-457c-4cd2-b3f2-e94fd5bf5a41',
        isActive: true,
        createdAt: '2026-06-10T08:00:00Z',
        modifiedAt: '2026-06-10T09:00:00Z',
      },
    ])
  })

  it('returns an empty array for no jobs', () => {
    expect(normalizeJobs([])).toEqual([])
  })
})
