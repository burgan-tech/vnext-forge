import { describe, expect, it } from 'vitest'

import { buildFunctionInfoPath, isValidRuntimePath, normalizeRuntimeHref } from '../src/index.js'

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

  describe('path segment validation', () => {
    // Regression: getInfo({ domain: 'core', functionKey: '../../../../actuator/env', scope: 'D' })
    // used to build "/api/v1/core/functions/../../../../actuator/env/info",
    // which resolves to http://<runtime>/actuator/env/info. Not cross-origin
    // (the base URL is pinned by string concatenation) but still a path this
    // function has no business emitting.
    it('rejects a functionKey that attempts path traversal', () => {
      expect(() =>
        buildFunctionInfoPath({ domain: 'core', functionKey: '../../../../actuator/env', scope: 'D' }),
      ).toThrow(/functionKey/)
    })

    it('still builds a normal key once segment validation is in place', () => {
      expect(buildFunctionInfoPath({ domain: 'core', functionKey: 'get-branches', scope: 'D' })).toBe(
        '/api/v1/core/functions/get-branches/info',
      )
    })

    it('rejects a traversal attempt in any of the four caller-controlled segments', () => {
      const traversal = '../../etc'
      expect(() =>
        buildFunctionInfoPath({ domain: traversal, functionKey: 'f', scope: 'D' }),
      ).toThrow(/domain/)
      expect(() =>
        buildFunctionInfoPath({
          domain: 'core', functionKey: 'f', scope: 'F', workflowKey: traversal, instanceId: 'i',
        }),
      ).toThrow(/workflowKey/)
      expect(() =>
        buildFunctionInfoPath({
          domain: 'core', functionKey: 'f', scope: 'I', workflowKey: 'w', instanceId: traversal,
        }),
      ).toThrow(/instanceId/)
    })
  })
})

describe('normalizeRuntimeHref', () => {
  // `/info` emits hrefs relative to the API root (e.g. "/core/functions/x"),
  // but the runtime serves them under /api/v1 (per quickrun.service.ts's
  // executeFunction route comments). Following a raw href would 404.
  it('prefixes an href that is missing the /api/v1 root', () => {
    expect(normalizeRuntimeHref('/core/functions/get-branches')).toBe('/api/v1/core/functions/get-branches')
  })

  it('leaves an href that already carries the prefix unchanged', () => {
    expect(normalizeRuntimeHref('/api/v1/core/functions/get-branches')).toBe(
      '/api/v1/core/functions/get-branches',
    )
  })

  it('is idempotent', () => {
    const once = normalizeRuntimeHref('/core/functions/get-branches')
    expect(normalizeRuntimeHref(once)).toBe(once)
  })

  it('leaves a non-rooted or scheme-bearing value unchanged, deferring to isValidRuntimePath', () => {
    expect(normalizeRuntimeHref('https://evil.test/core/functions/f')).toBe('https://evil.test/core/functions/f')
    expect(normalizeRuntimeHref('relative/functions/f')).toBe('relative/functions/f')
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

  it('rejects non-string input without throwing', () => {
    // Nothing Zod-parses this value yet (the method isn't registered), so the
    // guard has to be real rather than merely reading defensive.
    expect(() => isValidRuntimePath(0 as unknown as string)).not.toThrow()
    expect(isValidRuntimePath(0 as unknown as string)).toBe(false)
    expect(isValidRuntimePath(null as unknown as string)).toBe(false)
    expect(isValidRuntimePath(undefined as unknown as string)).toBe(false)
  })

  it('accepts query characters that are RFC 3986-legal but were previously rejected', () => {
    expect(isValidRuntimePath('/core/functions/f?q=a+b')).toBe(true)
    expect(isValidRuntimePath('/core/functions/f?ids=1,2,3')).toBe(true)
    expect(isValidRuntimePath('/core/functions/f?at=2026-08-05T10:00:00Z')).toBe(true)
    expect(isValidRuntimePath('/core/functions/f?a=1;b=2')).toBe(true)
    expect(isValidRuntimePath('/core/functions/f?tag=a!b')).toBe(true)
    expect(isValidRuntimePath('/core/functions/f?cb=(x)')).toBe(true)
  })

  describe('percent-encoded traversal (the path character class must keep excluding "%")', () => {
    // `path.includes('..')` only catches a literal "..". The *only* thing
    // rejecting these is that "%" never appears in the path character class,
    // so an encoded traversal segment fails the pattern match outright.
    // Do not "fix" a rejected function key (e.g. one containing `%20`) by
    // adding "%" to the path class — that reopens every case below.
    it('rejects lowercase percent-encoded dot-dot', () => {
      expect(isValidRuntimePath('/core/functions/f/%2e%2e/%2e%2e/admin')).toBe(false)
    })

    it('rejects uppercase percent-encoded dot-dot-slash', () => {
      expect(isValidRuntimePath('/core/functions/%2E%2E%2Fadmin')).toBe(false)
    })

    it('rejects a mixed literal-dot-dot / encoded-slash traversal', () => {
      expect(isValidRuntimePath('/core/functions/..%2fadmin')).toBe(false)
    })

    it('rejects an encoded /functions/ marker used to disguise a non-function route', () => {
      expect(isValidRuntimePath('/admin%2ffunctions%2fx')).toBe(false)
    })
  })

  describe('query-smuggling bypass (regression)', () => {
    // The original bug: scanning the *whole* href for "/functions/" let a
    // non-function path smuggle the marker through its query string. These
    // read as one invariant — the marker check must run on the path segment
    // only, and nothing else about validation should regress alongside it.
    it('rejects a non-function path that smuggles the marker through its query', () => {
      expect(isValidRuntimePath('/core/workflows/w/instances/i?x=/functions/y')).toBe(false)
    })

    it('rejects an encoded variant of the same smuggling attempt', () => {
      expect(isValidRuntimePath('/admin?a=%2ffunctions%2f')).toBe(false)
    })

    it('still accepts a genuine function route carrying an ordinary query', () => {
      // Guards against over-correcting to "reject any query mentioning /functions/".
      expect(isValidRuntimePath('/core/functions/f/view?target=input')).toBe(true)
    })

    it('pins that the split is path-only: a query mentioning an unrelated route is fine', () => {
      expect(isValidRuntimePath('/core/functions/f?x=/admin')).toBe(true)
    })

    it('rejects control characters trailing, embedded, and leading', () => {
      expect(isValidRuntimePath('/core/functions/f\n')).toBe(false)
      expect(isValidRuntimePath('/core/functions/f\r\nHost: evil')).toBe(false)
      expect(isValidRuntimePath('\n/core/functions/f')).toBe(false)
    })
  })
})
