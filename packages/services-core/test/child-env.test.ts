import { describe, expect, it } from 'vitest'

import {
  buildChildEnv,
  DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST,
} from '../src/lib/child-env.js'

describe('buildChildEnv (R-b17)', () => {
  it('keeps only allowlisted keys from process.env and merges extras', () => {
    const prevPath = process.env.PATH
    const prevSecret = process.env.VNEXT_FORGE_CHILD_ENV_TEST_SECRET
    process.env.PATH = '/test-bin'
    process.env.VNEXT_FORGE_CHILD_ENV_TEST_SECRET = 'leak'

    try {
      const env = buildChildEnv(['PATH'], { FOO: 'bar' })
      expect(env.PATH).toBe('/test-bin')
      expect(env.FOO).toBe('bar')
      expect(env.VNEXT_FORGE_CHILD_ENV_TEST_SECRET).toBeUndefined()
    } finally {
      if (prevPath !== undefined) process.env.PATH = prevPath
      else delete process.env.PATH
      if (prevSecret !== undefined) {
        process.env.VNEXT_FORGE_CHILD_ENV_TEST_SECRET = prevSecret
      } else {
        delete process.env.VNEXT_FORGE_CHILD_ENV_TEST_SECRET
      }
    }
  })

  it('exposes the default allowlist used by process adapters', () => {
    expect(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST).toContain('PATH')
    expect(DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST).toContain('NODE_ENV')
  })
})
