import { describe, expect, it } from 'vitest'

import { resourceLockIssues } from '@vnext-forge-studio/vnext-types'

const key = { location: './Lock.csx', code: 'base64' }
const lock = (extra: Record<string, unknown> = {}) => ({ keyExpression: key, action: 'Acquire', ...extra })
const manual = (k: string, extra: Record<string, unknown> = {}) => ({ key: k, target: 'b', triggerType: 0, ...extra })

function flow(states: Record<string, unknown>[], attributes: Record<string, unknown> = {}) {
  return { key: 'lab', attributes: { states, startTransition: { key: 'start', target: 'a', triggerType: 0 }, ...attributes } }
}

const boundary = (rule: Record<string, unknown>) => ({ onError: [rule] })
const codes = (doc: unknown) => resourceLockIssues(doc).map((i) => [i.code, i.severity])

describe('resourceLockIssues — ttlSeconds', () => {
  it('accepts an absent TTL (runtime default 300) and a positive one', () => {
    const doc = flow([{ key: 'a', transitions: [manual('t1', { resourceLock: lock() }), manual('t2', { resourceLock: lock({ ttlSeconds: 5 }) })] }])
    expect(resourceLockIssues(doc)).toEqual([])
  })

  it('rejects ttlSeconds <= 0 for Acquire and Extend, on state, shared and start transitions', () => {
    const doc = flow(
      [{ key: 'a', transitions: [manual('acq', { resourceLock: lock({ ttlSeconds: 0 }) }), manual('ext', { resourceLock: lock({ action: 'Extend', ttlSeconds: -1 }) })] }],
      {
        startTransition: { key: 'start', target: 'a', triggerType: 0, resourceLock: lock({ ttlSeconds: 0 }) },
        sharedTransitions: [manual('sh', { resourceLock: lock({ ttlSeconds: 0 }) })],
      },
    )
    expect(resourceLockIssues(doc).map((i) => [i.code, i.transitionKey, i.stateKey])).toEqual([
      ['resourceLock.ttlInvalid', 'start', undefined],
      ['resourceLock.ttlInvalid', 'sh', undefined],
      ['resourceLock.ttlInvalid', 'acq', 'a'],
      ['resourceLock.ttlInvalid', 'ext', 'a'],
    ])
  })

  it('exempts Release, which carries no TTL', () => {
    const doc = flow([{ key: 'a', transitions: [manual('rel', { resourceLock: lock({ action: 'Release', ttlSeconds: 0 }) })] }])
    expect(resourceLockIssues(doc)).toEqual([])
  })
})

describe('resourceLockIssues — error boundaries', () => {
  it('rejects Retry on a resource-lock conflict code, case-insensitively, at state and flow level', () => {
    const doc = flow(
      [{ key: 'a', transitions: [manual('go')], errorBoundary: boundary({ action: 1, errorCodes: ['execution:200010'] }) }],
      { errorBoundary: boundary({ action: 1, errorCodes: ['Execution:200014'] }) },
    )
    expect(codes(doc)).toEqual([
      ['errorBoundary.retryOnLockConflict', 'error'],
      ['errorBoundary.retryOnLockConflict', 'error'],
    ])
  })

  it('allows Retry for other codes', () => {
    const doc = flow([{ key: 'a', transitions: [manual('go')], errorBoundary: boundary({ action: 1, errorCodes: ['Task:400007'] }) }])
    expect(resourceLockIssues(doc)).toEqual([])
  })

  it('accepts the resource-lock-lab shape: state boundary routes 200010 to one of its own transitions', () => {
    const doc = flow([
      {
        key: 'rl-idle',
        transitions: [manual('rl-acquire', { resourceLock: lock() }), manual('rl-lock-busy')],
        errorBoundary: boundary({ action: 2, errorCodes: ['Execution:200010'], transition: 'rl-lock-busy', priority: 10 }),
      },
    ])
    expect(resourceLockIssues(doc)).toEqual([])
  })

  it('flags a state boundary routing to a transition unavailable from that state — error for lock codes, warning otherwise', () => {
    const doc = flow([
      {
        key: 'a',
        transitions: [manual('go')],
        errorBoundary: {
          onError: [
            { action: 2, errorCodes: ['Execution:200010'], transition: 'elsewhere' },
            { action: 0, errorCodes: ['Task:400007'], transition: 'elsewhere' },
          ],
        },
      },
      { key: 'b', transitions: [manual('elsewhere')] },
    ])
    expect(resourceLockIssues(doc).map((i) => [i.code, i.severity, i.ruleIndex, i.transitionKey])).toEqual([
      ['errorBoundary.transitionUnavailable', 'error', 0, 'elsewhere'],
      ['errorBoundary.transitionUnavailable', 'warning', 1, 'elsewhere'],
    ])
  })

  it('treats shared transitions by availableIn and cancel/updateData/exit as reachable from anywhere', () => {
    const rule = (transition: string) => ({ action: 0, errorCodes: ['Execution:200010'], transition })
    const doc = flow(
      [
        {
          key: 'a',
          transitions: [manual('go')],
          errorBoundary: { onError: [rule('everywhere'), rule('scoped-here'), rule('cancel'), rule('exit'), rule('update'), rule('scoped-other'), rule('start')] },
        },
      ],
      {
        sharedTransitions: [manual('everywhere'), manual('scoped-here', { availableIn: [{ state: 'a' }] }), manual('scoped-other', { availableIn: ['b'] })],
        cancel: manual('cancel'),
        exit: manual('exit'),
        updateData: manual('update'),
      },
    )
    expect(resourceLockIssues(doc).map((i) => i.transitionKey)).toEqual(['scoped-other', 'start'])
  })

  it('does not check availability for the workflow boundary', () => {
    const doc = flow([{ key: 'a', transitions: [manual('go')] }], {
      errorBoundary: boundary({ action: 0, errorCodes: ['Execution:200010'], transition: 'nowhere' }),
    })
    expect(resourceLockIssues(doc)).toEqual([])
  })

  it('warns when a boundary target declares a resource lock (the ErrorBoundary profile skips it)', () => {
    const doc = flow([
      {
        key: 'a',
        transitions: [manual('go'), manual('locked', { resourceLock: lock() })],
        errorBoundary: boundary({ action: 0, errorCodes: ['*'], transition: 'locked' }),
      },
    ])
    expect(codes(doc)).toEqual([['errorBoundary.targetSkipsLock', 'warning']])
  })

  it('ignores task boundaries', () => {
    const doc = flow([
      {
        key: 'a',
        onEntries: [{ order: 1, task: { key: 't' }, errorBoundary: boundary({ action: 1, errorCodes: ['Execution:200010'] }) }],
        transitions: [manual('go')],
      },
    ])
    expect(resourceLockIssues(doc)).toEqual([])
  })

  it('returns nothing for a non-workflow value', () => {
    expect(resourceLockIssues(null)).toEqual([])
    expect(resourceLockIssues({ key: 'x' })).toEqual([])
  })
})
