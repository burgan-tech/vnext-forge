import { describe, expect, it } from 'vitest'

import { buildFunctionInfoPath, isValidRuntimePath } from '../src/index.js'

describe('buildFunctionInfoPath', () => {
  it('routes a domain-scoped function to the domain route', () => {
    expect(buildFunctionInfoPath({ domain: 'core', functionKey: 'get-branches', scope: 'D' })).toBe(
      '/api/v1/core/functions/get-branches/info',
    )
  })

  it('routes flow- and instance-scoped functions to the instance route', () => {
    // The domain route rejects F/I with 403, so sending them there would look
    // like an authorization problem instead of a routing mistake.
    for (const scope of ['F', 'I'] as const) {
      expect(
        buildFunctionInfoPath({
          domain: 'core', functionKey: 'calc-limit', scope,
          workflowKey: 'onboarding', instanceId: 'abc-123',
        }),
      ).toBe('/api/v1/core/workflows/onboarding/instances/abc-123/functions/calc-limit/info')
    }
  })

  it('rejects F/I without a workflow key or instance id', () => {
    expect(() =>
      buildFunctionInfoPath({ domain: 'core', functionKey: 'f', scope: 'F', instanceId: 'i' }),
    ).toThrow(/workflowKey/)
    expect(() =>
      buildFunctionInfoPath({ domain: 'core', functionKey: 'f', scope: 'I', workflowKey: 'w' }),
    ).toThrow(/instanceId/)
  })
})

describe('isValidRuntimePath', () => {
  it('accepts the href shapes /info returns', () => {
    expect(isValidRuntimePath('/core/functions/get-branches')).toBe(true)
    expect(isValidRuntimePath('/core/functions/get-branches/view?target=input')).toBe(true)
    expect(isValidRuntimePath('/core/workflows/w/instances/i-1/functions/f/schema?target=output')).toBe(true)
  })

  it('rejects anything that could leave the runtime origin', () => {
    expect(isValidRuntimePath('https://evil.test/core/functions/f')).toBe(false)
    expect(isValidRuntimePath('//evil.test/core/functions/f')).toBe(false)
    expect(isValidRuntimePath('/core/functions/../../admin')).toBe(false)
    expect(isValidRuntimePath('relative/functions/f')).toBe(false)
  })

  it('rejects a path that is not a function route', () => {
    expect(isValidRuntimePath('/core/workflows/w/instances/i')).toBe(false)
  })

  it('rejects empty input and fragments', () => {
    expect(isValidRuntimePath('')).toBe(false)
    expect(isValidRuntimePath('/core/functions/f#frag')).toBe(false)
  })
})
