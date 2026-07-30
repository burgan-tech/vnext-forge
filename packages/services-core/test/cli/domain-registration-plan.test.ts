import { describe, expect, it } from 'vitest'

import {
  planDomainRegistration,
  type DesiredDomainRegistration,
} from '../../src/services/cli/domain-registration-plan.js'
import type { WfDomainEntry } from '../../src/services/cli/wf-domain-list.js'

const desired: DesiredDomainRegistration = {
  domainName: 'core',
  apiBaseUrl: 'http://localhost:4211',
  dbName: 'vNext_Core',
}

function entry(overrides: Partial<WfDomainEntry> = {}): WfDomainEntry {
  return {
    name: 'core',
    apiBaseUrl: 'http://localhost:4211',
    dbName: 'vNext_Core',
    active: false,
    ...overrides,
  }
}

describe('planDomainRegistration', () => {
  it('plans an add when the registry is empty', () => {
    expect(planDomainRegistration([], desired)).toEqual({ action: 'add' })
  })

  it('plans an add when the domain is not among the registered ones', () => {
    const existing = [entry({ name: 'other' }), entry({ name: 'another' })]

    expect(planDomainRegistration(existing, desired)).toEqual({ action: 'add' })
  })

  it('reports up-to-date when both the URL and the DB already match', () => {
    expect(planDomainRegistration([entry()], desired)).toEqual({ action: 'up-to-date' })
  })

  it('plans a replace when the API base URL differs', () => {
    const existing = [entry({ apiBaseUrl: 'http://localhost:4201' })]

    expect(planDomainRegistration(existing, desired)).toEqual({
      action: 'replace',
      wasActive: false,
    })
  })

  it('plans a replace when the DB name differs', () => {
    const existing = [entry({ dbName: 'vNext_Other' })]

    expect(planDomainRegistration(existing, desired)).toEqual({
      action: 'replace',
      wasActive: false,
    })
  })

  it('carries wasActive so the caller can restore the active domain after a replace', () => {
    // `removeDomain` silently switches ACTIVE_DOMAIN to "default" when the
    // removed domain was active, so the caller has to re-`use` it afterwards.
    const existing = [entry({ apiBaseUrl: 'http://localhost:4201', active: true })]

    expect(planDomainRegistration(existing, desired)).toEqual({
      action: 'replace',
      wasActive: true,
    })
  })

  it('treats a null apiBaseUrl as different — an unreadable value is not a match', () => {
    const existing = [entry({ apiBaseUrl: null })]

    expect(planDomainRegistration(existing, desired)).toEqual({
      action: 'replace',
      wasActive: false,
    })
  })

  it('treats a null dbName as different — an unreadable value is not a match', () => {
    const existing = [entry({ dbName: null })]

    expect(planDomainRegistration(existing, desired)).toEqual({
      action: 'replace',
      wasActive: false,
    })
  })

  it('blocks a mismatching "default" domain because the CLI refuses to remove it', () => {
    const existing = [entry({ name: 'default', apiBaseUrl: 'http://localhost:4201' })]

    expect(
      planDomainRegistration(existing, { ...desired, domainName: 'default' }),
    ).toEqual({ action: 'blocked-default' })
  })

  it('reports up-to-date rather than blocked for a matching "default" domain', () => {
    // Ordering decision pinned here: up-to-date wins over blocked-default.
    // Nothing needs doing, so reporting a block would be a false alarm about
    // a limitation we never hit.
    const existing = [entry({ name: 'default' })]

    expect(
      planDomainRegistration(existing, { ...desired, domainName: 'default' }),
    ).toEqual({ action: 'up-to-date' })
  })

  it('plans an add for a "default" domain that is not registered at all', () => {
    // Only *removal* of "default" is refused by the CLI; adding it is fine.
    expect(planDomainRegistration([], { ...desired, domainName: 'default' })).toEqual({
      action: 'add',
    })
  })

  it('matches domain names case-sensitively — "Core" is not "core"', () => {
    const existing = [entry({ name: 'Core' })]

    // Same values, different casing: the CLI would treat these as two
    // separate domains, so this must be an add, not up-to-date.
    expect(planDomainRegistration(existing, desired)).toEqual({ action: 'add' })
  })

  it('compares apiBaseUrl exactly — a trailing slash is a different registration', () => {
    const existing = [entry({ apiBaseUrl: 'http://localhost:4211/' })]

    expect(planDomainRegistration(existing, desired)).toEqual({
      action: 'replace',
      wasActive: false,
    })
  })
})
