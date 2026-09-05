import { describe, expect, it } from 'vitest'

import { VnextForgeError } from '@vnext-forge-studio/app-contracts'
import {
  computePackageJsonUpdate,
  schemaVersionRange,
} from '../src/services/workspace/schema-version-sync.js'

describe('schemaVersionRange', () => {
  it('prefixes a caret unless one is present', () => {
    expect(schemaVersionRange('0.0.53')).toBe('^0.0.53')
    expect(schemaVersionRange(' 0.0.53 ')).toBe('^0.0.53')
    expect(schemaVersionRange('^0.0.53')).toBe('^0.0.53')
    expect(schemaVersionRange('~0.0.53')).toBe('~0.0.53')
  })
})

describe('computePackageJsonUpdate', () => {
  it('updates dependencies only when devDependencies does not pin the package', () => {
    const text = JSON.stringify({ name: 'x', dependencies: { '@burgan-tech/vnext-schema': '^0.0.52' }, devDependencies: { vitest: '^3' } }, null, 2) + '\n'
    const r = computePackageJsonUpdate(text, '0.0.53')
    expect(r.changed).toBe(true)
    expect(r.touched).toEqual(['dependencies'])
    const parsed = JSON.parse(r.nextText)
    expect(parsed.dependencies['@burgan-tech/vnext-schema']).toBe('^0.0.53')
    expect(parsed.devDependencies).toEqual({ vitest: '^3' })
    expect(r.nextText.endsWith('\n')).toBe(true)
  })

  it('updates both sections when both pin the package (template layout)', () => {
    const text = JSON.stringify({ dependencies: { '@burgan-tech/vnext-schema': '^0.0.52' }, devDependencies: { '@burgan-tech/vnext-schema': '^0.0.52' } })
    const r = computePackageJsonUpdate(text, '0.0.53')
    expect(r.touched).toEqual(['dependencies', 'devDependencies'])
    const parsed = JSON.parse(r.nextText)
    expect(parsed.dependencies['@burgan-tech/vnext-schema']).toBe('^0.0.53')
    expect(parsed.devDependencies['@burgan-tech/vnext-schema']).toBe('^0.0.53')
    expect(r.nextText.endsWith('\n')).toBe(false)
  })

  it('creates dependencies when neither section exists', () => {
    const r = computePackageJsonUpdate('{"name":"bare"}', '0.0.53')
    expect(r.changed).toBe(true)
    expect(JSON.parse(r.nextText).dependencies).toEqual({ '@burgan-tech/vnext-schema': '^0.0.53' })
  })

  it('is a no-op when the range already matches', () => {
    const text = JSON.stringify({ dependencies: { '@burgan-tech/vnext-schema': '^0.0.53' } }, null, 2)
    const r = computePackageJsonUpdate(text, '0.0.53')
    expect(r.changed).toBe(false)
    expect(r.nextText).toBe(text)
    expect(r.touched).toEqual([])
  })

  it('preserves 4-space and tab indentation', () => {
    const four = JSON.stringify({ dependencies: { '@burgan-tech/vnext-schema': '^0.0.1' } }, null, 4) + '\n'
    expect(computePackageJsonUpdate(four, '0.0.2').nextText).toBe(
      JSON.stringify({ dependencies: { '@burgan-tech/vnext-schema': '^0.0.2' } }, null, 4) + '\n',
    )
    const tabs = JSON.stringify({ dependencies: { '@burgan-tech/vnext-schema': '^0.0.1' } }, null, '\t')
    expect(computePackageJsonUpdate(tabs, '0.0.2').nextText).toBe(
      JSON.stringify({ dependencies: { '@burgan-tech/vnext-schema': '^0.0.2' } }, null, '\t'),
    )
  })

  it('throws a VnextForgeError on invalid JSON', () => {
    expect(() => computePackageJsonUpdate('{ nope', '0.0.1')).toThrow(VnextForgeError)
    expect(() => computePackageJsonUpdate('[]', '0.0.1')).toThrow(VnextForgeError)
  })
})
