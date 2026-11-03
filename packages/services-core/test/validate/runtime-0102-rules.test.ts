import { describe, expect, it } from 'vitest'

import {
  autoTransitionEvaluationOrder,
  rowSecurityIssues,
  transitionPriorityIssues,
} from '@vnext-forge-studio/vnext-types'

const auto = (key: string, extra: Record<string, unknown> = {}) => ({ key, target: 't', triggerType: 1, ...extra })

function flow(states: Record<string, unknown>[], attributes: Record<string, unknown> = {}, key = 'kyc') {
  return { key, attributes: { states, startTransition: { key: 'start', target: 'a', triggerType: 0 }, ...attributes } }
}

describe('transitionPriorityIssues', () => {
  it('accepts priority on a state-level automatic transition', () => {
    const doc = flow([{ key: 'a', transitions: [auto('hi', { priority: 10 }), auto('lo')] }])
    expect(transitionPriorityIssues(doc)).toEqual([])
  })

  it('rejects priority on manual, default-auto, shared and start transitions', () => {
    const doc = flow(
      [{ key: 'a', transitions: [{ ...auto('m'), triggerType: 0, priority: 2 }, auto('d', { triggerKind: 10, priority: 3 })] }],
      {
        startTransition: { key: 'start', target: 'a', triggerType: 0, priority: 1 },
        sharedTransitions: [{ key: 's', target: 'a', triggerType: 0, priority: 1 }],
      },
    )
    const codes = transitionPriorityIssues(doc).map((i) => [i.code, i.transitionKey])
    expect(codes).toEqual([
      ['priority.notAllowed', 'start'],
      ['priority.notAllowed', 's'],
      ['priority.notAllowed', 'm'],
      ['priority.notAllowed', 'd'],
    ])
  })

  it('rejects a priority below 1 or a fraction', () => {
    const doc = flow([{ key: 'a', transitions: [auto('x', { priority: 0 }), auto('y', { priority: 1.5 })] }])
    expect(transitionPriorityIssues(doc).map((i) => i.code)).toEqual(['priority.invalid', 'priority.invalid'])
  })

  it('warns on a shared effective priority only when one is explicit', () => {
    const implicit = flow([{ key: 'a', transitions: [auto('x'), auto('y')] }])
    expect(transitionPriorityIssues(implicit)).toEqual([])
    const explicit = flow([{ key: 'a', transitions: [auto('x'), auto('y', { priority: 100 })] }])
    expect(transitionPriorityIssues(explicit)).toMatchObject([{ code: 'priority.tie', severity: 'warning', stateKey: 'a', transitionKey: 'y' }])
  })

  it('orders automatic transitions by priority, then declaration, default last', () => {
    const order = autoTransitionEvaluationOrder([
      auto('def', { triggerKind: 10 }),
      auto('plain'),
      { key: 'manual', triggerType: 0 },
      auto('first', { priority: 5 }),
      auto('plain2'),
    ]).map((t) => t.key)
    expect(order).toEqual(['first', 'plain', 'plain2', 'def'])
  })
})

describe('rowSecurityIssues', () => {
  const withRules = (rowSecurity: unknown, states: Record<string, unknown>[] = [], key = 'kyc') =>
    flow(states, { rowSecurity }, key)

  it('is empty without rowSecurity and for the handoff example', () => {
    expect(rowSecurityIssues(flow([]))).toEqual([])
    const example = {
      rules: [
        { roles: ['branch-staff'], filter: { attributes: { branchCode: { eq: '$.context.Headers.x-branch-code' } } } },
        { roles: ['hq-auditor'] },
        { roles: ['customer'], filter: { createdBy: { eq: '$InstanceStarter' } } },
        { roles: ['region-manager'], filter: { attributes: { branchCode: { in: { $param: '$.context.Headers.x-branches', split: ',' } } } } },
        { roles: ['$InstanceStarter'], filter: { status: { eq: 'A' } } },
      ],
    }
    expect(rowSecurityIssues(withRules(example))).toEqual([])
  })

  it('flags empty rules, empty roles and unknown members (RS-E12)', () => {
    expect(rowSecurityIssues(withRules({ rules: [] })).map((i) => i.code)).toEqual(['RS-E12'])
    expect(rowSecurityIssues(withRules({ rules: [{ roles: [] }] })).map((i) => i.code)).toEqual(['RS-E12'])
    expect(rowSecurityIssues(withRules({ rules: [{ roles: ['a'], sort: 1 }], default: true })).map((i) => i.code)).toEqual([
      'RS-E12',
      'RS-E12',
    ])
  })

  it('rejects reserved roles other than the identity ones', () => {
    const codes = rowSecurityIssues(
      withRules({ rules: [{ roles: ['$PreviousUser'] }, { roles: ['$user.alice'] }, { roles: ['$Anything'] }, { roles: ['a', '$InstanceStarter'] }] }),
    ).map((i) => i.code)
    expect(codes).toEqual(['RS-E01', 'RS-E02', 'RS-E05', 'RS-E04'])
  })

  it('checks parameters, shorthands and operator shapes', () => {
    const rule = (filter: Record<string, unknown>) => ({ rules: [{ roles: ['a'], filter }] })
    const code = (filter: Record<string, unknown>) => rowSecurityIssues(withRules(rule(filter))).map((i) => i.code)
    expect(code({ attributes: { b: { eq: '$.context.Route.id' } } })).toEqual(['RS-E07'])
    expect(code({ attributes: { b: { eq: '$.context.CurrentUser.Email' } } })).toEqual(['RS-E07'])
    expect(code({ attributes: { b: { eq: '$InstanceStarter' } } })).toEqual(['RS-E06'])
    expect(code({ attributes: { b: { like: '$.context.Headers.x' } } })).toEqual(['RS-E17'])
    expect(code({ attributes: { b: { eq: { $param: '$.context.Headers.x', split: ',' } } } })).toEqual(['RS-E11'])
    expect(code({ attributes: { b: { between: ['1'] } } })).toEqual(['RS-E10'])
    expect(code({ attributes: { b: { eq: '1' } }, orderBy: 'x' })).toEqual(['RS-E13'])
    expect(code({ attributes: { b: { eq: '$.Context.Headers.x' } } })).toEqual(['RS-W4'])
    expect(code({ attributes: { b: { ne: 'x' } } })).toEqual(['RS-W2c'])
    expect(code({ or: [{ createdByBehalfOf: { eq: '$InstanceBehalfOfStarter' } }, { attributes: { b: { ne: 'x' } } }] })).toEqual([])
  })

  it('rejects rowSecurity on a sys-* flow and notes SubFlow states', () => {
    const issues = rowSecurityIssues(withRules({ rules: [{ roles: ['a'] }] }, [{ key: 'child', subFlow: { type: 'S' } }], 'sys-x'))
    expect(issues.map((i) => i.code)).toEqual(['RS-E16', 'RS-W7'])
  })
})
