import { describe, expect, it } from 'vitest'

import { compareCoreSemver, extractCoreSemver } from '../../src/services/cli/semver.js'

describe('extractCoreSemver', () => {
  it('finds the first core version in common CLI/npm outputs', () => {
    expect(extractCoreSemver('1.0.13')).toBe('1.0.13')
    expect(extractCoreSemver('v1.0.13\n')).toBe('1.0.13')
    expect(extractCoreSemver('wf 2.0.0')).toBe('2.0.0')
    expect(extractCoreSemver('1.2.3-beta.1+build.5')).toBe('1.2.3')
    expect(extractCoreSemver('nope')).toBeNull()
  })
})

describe('compareCoreSemver', () => {
  it('orders numerically per segment', () => {
    expect(compareCoreSemver('1.0.13', '1.0.12')).toBeGreaterThan(0)
    expect(compareCoreSemver('1.0.9', '1.0.13')).toBeLessThan(0)
    expect(compareCoreSemver('1.1.0', '1.0.99')).toBeGreaterThan(0)
    expect(compareCoreSemver('1.0.13', '1.0.13')).toBe(0)
  })
})
