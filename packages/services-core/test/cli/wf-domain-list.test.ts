import { describe, expect, it } from 'vitest'

import { findWfDomain, parseWfDomainList } from '../../src/services/cli/wf-domain-list.js'

// Fixtures captured from the real `wf domain list` producer
// (vnext-workflow-cli/src/commands/domain.js, listDomains()) by running its
// exact chalk-formatting logic with FORCE_COLOR=1 and JSON.stringify-ing the
// result, so the escape sequences below are byte-for-byte what the real CLI
// emits - not hand-imagined ANSI codes.

// Two domains, "core" active.
const TWO_DOMAINS_CORE_ACTIVE =
  '\u001b[36m\u001b[1m\u001b[22m\u001b[39m\n\u001b[36m\u001b[1m🌐 Domains:\u001b[22m\u001b[39m\n\u001b[36m\u001b[1m\u001b[22m\u001b[39m\n\u001b[32m▸ \u001b[39m\u001b[32m\u001b[1mcore\u001b[22m\u001b[39m\u001b[32m (active)\u001b[39m\n\u001b[2m    API: http://localhost:4201  DB: vnext_core\u001b[22m\n  \u001b[37mstaging\u001b[39m\n\u001b[2m    API: http://localhost:4202  DB: vnext_staging\u001b[22m\n\n'

// A single domain, active.
const ONE_DOMAIN_ACTIVE =
  '\u001b[36m\u001b[1m\u001b[22m\u001b[39m\n\u001b[36m\u001b[1m🌐 Domains:\u001b[22m\u001b[39m\n\u001b[36m\u001b[1m\u001b[22m\u001b[39m\n\u001b[32m▸ \u001b[39m\u001b[32m\u001b[1mcore\u001b[22m\u001b[39m\u001b[32m (active)\u001b[39m\n\u001b[2m    API: http://localhost:4201  DB: vnext_core\u001b[22m\n\n'

describe('parseWfDomainList', () => {
  it('parses two domains where the first is active', () => {
    const entries = parseWfDomainList(TWO_DOMAINS_CORE_ACTIVE)

    expect(entries).toEqual([
      { name: 'core', apiBaseUrl: 'http://localhost:4201', dbName: 'vnext_core', active: true },
      { name: 'staging', apiBaseUrl: 'http://localhost:4202', dbName: 'vnext_staging', active: false },
    ])
  })

  it('parses a single active domain', () => {
    const entries = parseWfDomainList(ONE_DOMAIN_ACTIVE)

    expect(entries).toEqual([
      { name: 'core', apiBaseUrl: 'http://localhost:4201', dbName: 'vnext_core', active: true },
    ])
  })

  it('defaults apiBaseUrl/dbName to null when the detail line is missing', () => {
    const output = [
      '🌐 Domains:',
      '',
      '▸ core (active)',
      '',
      '  staging',
      '    API: http://localhost:4202  DB: vnext_staging',
      '',
    ].join('\n')

    const entries = parseWfDomainList(output)

    expect(entries).toEqual([
      { name: 'core', apiBaseUrl: null, dbName: null, active: true },
      { name: 'staging', apiBaseUrl: 'http://localhost:4202', dbName: 'vnext_staging', active: false },
    ])
  })

  it('returns [] for garbage/unrecognised input rather than throwing', () => {
    expect(parseWfDomainList('lorem ipsum dolor\nsit amet consectetur')).toEqual([])
  })

  it('returns [] for empty input', () => {
    expect(parseWfDomainList('')).toEqual([])
  })
})

describe('findWfDomain', () => {
  const entries = [
    { name: 'core', apiBaseUrl: 'http://localhost:4201', dbName: 'vnext_core', active: true },
    { name: 'Core', apiBaseUrl: 'http://localhost:9999', dbName: 'vnext_other', active: false },
  ]

  it('finds an entry by exact name', () => {
    expect(findWfDomain(entries, 'core')).toEqual(entries[0])
  })

  it('returns null on a miss', () => {
    expect(findWfDomain(entries, 'staging')).toBeNull()
  })

  it('is case-sensitive - "Core" must not match "core"', () => {
    expect(findWfDomain(entries, 'Core')).toEqual(entries[1])
    expect(findWfDomain([entries[0]], 'Core')).toBeNull()
  })
})
