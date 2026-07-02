import { describe, it, expect } from 'vitest'
import { buildJobsTimeParams } from './jobs-time-params'

describe('buildJobsTimeParams', () => {
  it('builds left-handed bracket-notation keys for from/to', () => {
    const params = buildJobsTimeParams({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-27T23:59:59.000Z',
      label: 'Last 27 days',
    })
    expect(params).toEqual({
      'createdAt[gte]': '2026-06-01T00:00:00.000Z',
      'createdAt[lte]': '2026-06-27T23:59:59.000Z',
    })
  })

  it('omits a bound when it is empty', () => {
    const params = buildJobsTimeParams({ from: '', to: '2026-06-27T23:59:59.000Z', label: '' })
    expect(params).toEqual({ 'createdAt[lte]': '2026-06-27T23:59:59.000Z' })
  })
})
