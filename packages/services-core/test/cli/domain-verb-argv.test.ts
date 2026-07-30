import { describe, expect, it } from 'vitest'

import {
  buildDomainListArgv,
  buildDomainRemoveArgv,
  buildDomainUseArgv,
} from '../../src/services/cli/cli.service.js'

describe('domain verb argv builders', () => {
  it('builds `domain list` with no further arguments', () => {
    expect(buildDomainListArgv()).toEqual(['domain', 'list'])
  })

  it('builds `domain remove <name>`', () => {
    expect(buildDomainRemoveArgv('core')).toEqual(['domain', 'remove', 'core'])
  })

  it('builds `domain use <name>`', () => {
    expect(buildDomainUseArgv('core')).toEqual(['domain', 'use', 'core'])
  })

  it('passes the domain name through verbatim, without shell quoting or casing changes', () => {
    // The name reaches execFile as a single argv element, so it must not be
    // pre-quoted; and domain names are case-sensitive to the CLI.
    expect(buildDomainRemoveArgv('My Domain')).toEqual(['domain', 'remove', 'My Domain'])
    expect(buildDomainUseArgv('Core')).toEqual(['domain', 'use', 'Core'])
  })
})
