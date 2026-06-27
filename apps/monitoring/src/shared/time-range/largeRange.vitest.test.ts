import { describe, it, expect } from 'vitest'
import { rangeExceeds30Days } from './largeRange'

describe('rangeExceeds30Days', () => {
  it('returns false for a range of exactly 30 days', () => {
    const from = '2026-06-01T00:00:00.000Z'
    const to = '2026-07-01T00:00:00.000Z' // exactly 30 days later
    expect(rangeExceeds30Days({ from, to })).toBe(false)
  })

  it('returns true for a range longer than 30 days', () => {
    const from = '2026-06-01T00:00:00.000Z'
    const to = '2026-07-01T00:00:01.000Z' // 30 days + 1s
    expect(rangeExceeds30Days({ from, to })).toBe(true)
  })

  it('returns false for a short range', () => {
    const from = '2026-06-26T00:00:00.000Z'
    const to = '2026-06-27T00:00:00.000Z'
    expect(rangeExceeds30Days({ from, to })).toBe(false)
  })
})
