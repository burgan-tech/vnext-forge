import { describe, expect, it } from 'vitest'

import {
  buildFunctionInfoPath,
  isValidRuntimePath,
  normalizeRuntimeHref,
  rebaseRuntimeHref,
} from '../src/index.js'

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

    it('rejects a dot-only segment, which the earlier "." + "~" allowance let through', () => {
      // Regression: PATH_SEGMENT used to allow "." (and "~"), so a segment
      // of exactly ".." was itself a legal "path segment" even though it's a
      // traversal element once spliced between the literals this function
      // inserts:
      //   functionKey: '..' -> "/api/v1/core/functions/../info" -> resolves to "/api/v1/core/info"
      //   domain: '..'      -> "/api/v1/../functions/env/info"  -> resolves to "/api/functions/env/info"
      // isValidRuntimePath already rejects any ".." outright; PATH_SEGMENT
      // must agree, or the two guards on the same concatenated path disagree
      // about the most important input either of them checks.
      expect(() =>
        buildFunctionInfoPath({ domain: 'core', functionKey: '..', scope: 'D' }),
      ).toThrow(/functionKey/)
      expect(() =>
        buildFunctionInfoPath({ domain: '..', functionKey: 'env', scope: 'D' }),
      ).toThrow(/domain/)
    })

    it('still accepts a UUID instanceId (instance ids are UUIDs)', () => {
      expect(
        buildFunctionInfoPath({
          domain: 'core', functionKey: 'f', scope: 'I',
          workflowKey: 'onboarding', instanceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        }),
      ).toBe('/api/v1/core/workflows/onboarding/instances/f47ac10b-58cc-4372-a567-0e02b2c3d479/functions/f/info')
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

  it('rebases a contract href that carries a query string, keeping the query intact', () => {
    // The exact shape `/info` returns for a declared view — the gateway-style
    // path plus `?target=input`. Both halves matter: the path has to gain the
    // /api/v1 root, and `target` has to survive, or the runtime cannot tell
    // the input view from the output one.
    const href = '/core/functions/get-branches-func/view?target=input'
    const normalized = normalizeRuntimeHref(href)
    expect(normalized).toBe('/api/v1/core/functions/get-branches-func/view?target=input')
    expect(isValidRuntimePath(normalized)).toBe(true)
  })

  it('rebases a schema href the same way', () => {
    expect(normalizeRuntimeHref('/core/functions/get-branches-func/schema?target=output')).toBe(
      '/api/v1/core/functions/get-branches-func/schema?target=output',
    )
  })

  it('APPENDS rather than replaces — which is why rebaseRuntimeHref exists', () => {
    // Pinning the limitation this function has, so nobody "fixes" a
    // gateway-prefixed href here and leaves `rebaseRuntimeHref` behind.
    expect(normalizeRuntimeHref('/api/core/functions/f/view?target=input')).toBe(
      '/api/v1/api/core/functions/f/view?target=input',
    )
  })
})

describe('rebaseRuntimeHref', () => {
  const RUNTIME = '/api/v1/core/functions/get-branches-func/view?target=input'

  it('strips the /api gateway prefix instead of stacking /api/v1 on top of it', () => {
    // The bug this function exists for: the engine emits gateway-relative
    // hrefs, and `normalizeRuntimeHref` only ever appends — so this href
    // became `/api/v1/api/core/...`, which passes `isValidRuntimePath`, then
    // 404s, and surfaces as "this input view could not be loaded".
    expect(rebaseRuntimeHref('/api/core/functions/get-branches-func/view?target=input', 'core')).toBe(RUNTIME)
  })

  it('handles the un-prefixed form of the same href identically', () => {
    // Both shapes have been observed from the same engine.
    expect(rebaseRuntimeHref('/core/functions/get-branches-func/view?target=input', 'core')).toBe(RUNTIME)
  })

  it('is idempotent on an href that is already a runtime path', () => {
    expect(rebaseRuntimeHref(RUNTIME, 'core')).toBe(RUNTIME)
    expect(rebaseRuntimeHref(rebaseRuntimeHref(RUNTIME, 'core'), 'core')).toBe(RUNTIME)
  })

  it('rebases the invoke href too, not just contract hrefs', () => {
    // `runInvoke` follows `info.function.href`, so a gateway prefix breaks
    // Send exactly the same way it broke the view.
    expect(rebaseRuntimeHref('/api/core/functions/get-branches-func', 'core')).toBe(
      '/api/v1/core/functions/get-branches-func',
    )
  })

  it('keeps the whole runtime path for an instance-scoped href', () => {
    expect(
      rebaseRuntimeHref('/api/core/workflows/acc/instances/i-1/functions/f/view?target=output', 'core'),
    ).toBe('/api/v1/core/workflows/acc/instances/i-1/functions/f/view?target=output')
  })

  it('anchors on the first domain segment, not a later one that repeats it', () => {
    // A function or workflow named the same as its domain must not move the
    // anchor further right and swallow real path segments.
    expect(rebaseRuntimeHref('/api/core/functions/core', 'core')).toBe('/api/v1/core/functions/core')
  })

  it('preserves an empty query and a multi-parameter one alike', () => {
    expect(rebaseRuntimeHref('/api/core/functions/f?', 'core')).toBe('/api/v1/core/functions/f?')
    expect(rebaseRuntimeHref('/api/core/functions/f?a=1&b=2', 'core')).toBe('/api/v1/core/functions/f?a=1&b=2')
  })

  it('falls back to prefix-if-missing when the domain is absent from the path', () => {
    // Better a guess than mangling an href whose shape this does not know.
    expect(rebaseRuntimeHref('/other/functions/f', 'core')).toBe('/api/v1/other/functions/f')
    expect(rebaseRuntimeHref('/api/v1/other/functions/f', 'core')).toBe('/api/v1/other/functions/f')
  })

  it('falls back when no domain is supplied at all', () => {
    expect(rebaseRuntimeHref('/core/functions/f', '')).toBe('/api/v1/core/functions/f')
  })

  it('leaves a scheme-bearing or non-rooted value for isValidRuntimePath to reject', () => {
    expect(rebaseRuntimeHref('https://evil.test/core/functions/f', 'core')).toBe(
      'https://evil.test/core/functions/f',
    )
    expect(rebaseRuntimeHref('relative/core/functions/f', 'core')).toBe('relative/core/functions/f')
  })

  it('produces paths that still satisfy isValidRuntimePath', () => {
    for (const href of [
      '/api/core/functions/f/view?target=input',
      '/core/functions/f',
      '/api/v1/core/workflows/w/instances/i/functions/f/schema?target=output',
    ]) {
      expect(isValidRuntimePath(rebaseRuntimeHref(href, 'core'))).toBe(true)
    }
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
    // Unit-level only: called directly on this raw value, the leading "//"
    // check rejects it here. But the service never calls isValidRuntimePath
    // on a raw href — normalizeRuntimeHref runs first, and since this value
    // starts with "/" but not "/api/v1/", it gets prefixed to
    // "/api/v1//evil.test/core/functions/f", which *does* pass this
    // validator (it starts with "/api/v1", not "//", and still contains
    // "/functions/"). This never leaves the runtime origin regardless — the
    // real protection is `runtime-proxy` pinning the base URL by string
    // concatenation, not this check. Don't read this assertion as proof the
    // service is protected against a leading "//" past normalization, and
    // don't "simplify" normalizeRuntimeHref on the strength of it.
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
