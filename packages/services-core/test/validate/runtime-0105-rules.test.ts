import { describe, expect, it } from 'vitest'

import {
  PREDEFINED_ROLES,
  exemptionRoleIssue,
  predefinedRoleCasingIssue,
  transitionSchemaEntries,
  transitionSchemasIssues,
} from '@vnext-forge-studio/vnext-types'

const ref = (key: string) => ({ key, domain: 'core', flow: 'sys-schemas', version: '1.0.0' })
const rule = { location: './src/IsCorporate.csx', code: 'Y29kZQ==', encoding: 'B64' }

function flow(states: Record<string, unknown>[], attributes: Record<string, unknown> = {}) {
  return { key: 'kyc', attributes: { states, startTransition: { key: 'start', target: 'a', triggerType: 0 }, ...attributes } }
}

describe('transitionSchemaEntries', () => {
  it('reads the plain array and the wrapped form; anything else is empty', () => {
    const entries = [{ rule, schema: ref('a') }, { schema: ref('b') }]
    expect(transitionSchemaEntries(entries)).toEqual(entries)
    expect(transitionSchemaEntries({ schemas: entries })).toEqual(entries)
    expect(transitionSchemaEntries(null)).toEqual([])
    expect(transitionSchemaEntries(ref('x'))).toEqual([])
  })
})

describe('transitionSchemasIssues (runtime 0.0.105 publish checks)', () => {
  it('accepts rule entries with a trailing fallback, on every allowed kind', () => {
    const schemas = [{ rule, schema: ref('corp') }, { rule, schema: ref('sme') }, { schema: ref('retail') }]
    const doc = flow(
      [{ key: 'a', transitions: [{ key: 'm', target: 'b', triggerType: 0, schemas }, { key: 'e', target: 'b', triggerType: 3, schemas: { schemas } }] }],
      {
        startTransition: { key: 'start', target: 'a', triggerType: 0, schemas },
        cancel: { key: 'cancel', target: 'x', triggerType: 0, schemas },
        sharedTransitions: [{ key: 's', target: 'b', triggerType: 0, schemas }],
      },
    )
    expect(transitionSchemasIssues(doc)).toEqual([])
  })

  it('rejects a rule-less entry that is not last', () => {
    const doc = flow([{ key: 'a', transitions: [{ key: 'm', target: 'b', triggerType: 0, schemas: [{ schema: ref('x') }, { rule, schema: ref('y') }] }] }])
    expect(transitionSchemasIssues(doc)).toMatchObject([
      { code: 'schemas.fallbackNotLast', severity: 'error', stateKey: 'a', transitionKey: 'm', entryIndex: 0 },
    ])
  })

  it('rejects schemas on automatic, scheduled and timeout transitions', () => {
    const schemas = [{ schema: ref('x') }]
    const doc = flow(
      [{ key: 'a', transitions: [{ key: 'auto', target: 'b', triggerType: 1, schemas }, { key: 'sch', target: 'b', triggerType: 2, schemas }] }],
      { timeout: { key: 'to', target: 'x', schemas } },
    )
    expect(transitionSchemasIssues(doc).map((i) => [i.code, i.transitionKey])).toEqual([
      ['schemas.notAllowed', 'to'],
      ['schemas.notAllowed', 'auto'],
      ['schemas.notAllowed', 'sch'],
    ])
  })

  it('warns when schema is declared too (schemas wins); ignores empty / null schemas', () => {
    const doc = flow([
      { key: 'a', transitions: [
        { key: 'both', target: 'b', triggerType: 0, schema: ref('one'), schemas: [{ schema: ref('x') }] },
        { key: 'nul', target: 'b', triggerType: 1, schemas: null },
      ] },
    ])
    expect(transitionSchemasIssues(doc)).toMatchObject([{ code: 'schemas.shadowsSchema', severity: 'warning', transitionKey: 'both' }])
  })
})

describe('$Everyone predefined role', () => {
  it('is offered with the other predefined roles', () => {
    expect(PREDEFINED_ROLES.map((p) => p.role)).toEqual([
      '$InstanceStarter',
      '$InstanceBehalfOfStarter',
      '$PreviousUser',
      '$PreviousBehalfOfUser',
      '$Everyone',
    ])
  })

  it('mirrors the Ordinal spelling check (only $Everyone)', () => {
    expect(predefinedRoleCasingIssue('$Everyone')).toBeUndefined()
    expect(predefinedRoleCasingIssue('$everyone')).toMatch(/case-sensitive, write '\$Everyone'/)
    expect(predefinedRoleCasingIssue('$EVERYONE')).toBeDefined()
    expect(predefinedRoleCasingIssue('$instancestarter')).toBeUndefined()
    expect(predefinedRoleCasingIssue('maker')).toBeUndefined()
  })

  it('is refused in x-masking / x-encryption exemption lists', () => {
    expect(exemptionRoleIssue('$Everyone')).toMatch(/exempt every caller/)
    expect(exemptionRoleIssue('$everyone')).toBeDefined()
    expect(exemptionRoleIssue('auditor')).toBeUndefined()
  })
})
