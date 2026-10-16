import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import { historyNoneIssues, readHistoryMode, subFlowChildRefs } from '@vnext-forge-studio/vnext-types'

const require_ = createRequire(import.meta.url)
const pkg = require_('@burgan-tech/vnext-schema') as { getSchema(type: string): Record<string, unknown> }
const ajv = new Ajv2019({ strict: false, allErrors: true })
addFormats(ajv as never)
const validateWorkflow = ajv.compile(pkg.getSchema('workflow')!)

type Doc = { attributes: Record<string, unknown> & { states: Record<string, unknown>[] } }

/** timeout-lab-root reshaped into a valid one-shot flow. */
function oneShot(): Doc {
  const doc = JSON.parse(
    readFileSync(new URL('../fixtures/runtime-sync/timeout-lab-root.json', import.meta.url), 'utf8'),
  ) as Doc
  const a = doc.attributes
  a.history = 'none'
  delete a.timeout
  delete a.cancel
  delete a.exit
  delete a.updateData
  a.sharedTransitions = []
  for (const state of a.states) {
    for (const t of (state.transitions as Record<string, unknown>[] | undefined) ?? []) t.triggerType = 1
  }
  return doc
}

const codes = (doc: Doc) => historyNoneIssues(doc).map((issue) => issue.code)

describe('historyNoneIssues mirrors the vnext-schema 0.0.56 rules', () => {
  it('accepts a valid one-shot flow (and the package agrees)', () => {
    const doc = oneShot()
    expect(historyNoneIssues(doc)).toEqual([])
    expect(validateWorkflow(doc)).toBe(true)
    expect(readHistoryMode(doc)).toBe('none')
  })

  const cases: [string, (doc: Doc) => void, string][] = [
    ['flow-level cancel', (d) => (d.attributes.cancel = { key: 'c', target: 'root-cancelled', triggerType: 0, versionStrategy: 'Major' }), 'history.flowTransition'],
    ['shared transitions', (d) => (d.attributes.sharedTransitions = [{ key: 's', target: 'root-completed', triggerType: 1, versionStrategy: 'Major', availableIn: ['root-waiting'] }]), 'history.sharedTransitions'],
    ['manual transition', (d) => ((d.attributes.states[0]!.transitions as Record<string, unknown>[])[0]!.triggerType = 0), 'history.manualTrigger'],
    ['wizard state', (d) => (d.attributes.states[0]!.stateType = 5), 'history.wizardState'],
    ['human sub-type', (d) => (d.attributes.states[0]!.subType = 6), 'history.waitingSubType'],
    ['no Finish state', (d) => d.attributes.states.forEach((s) => s.stateType === 3 && (s.stateType = 2, s.transitions = [{ key: 'x', target: 'root-waiting', triggerType: 1, versionStrategy: 'Major' }])), 'history.noFinish'],
    ['state without transitions', (d) => (d.attributes.states[0]!.transitions = []), 'history.noTransitions'],
  ]

  for (const [name, mutate, code] of cases) {
    it(`flags ${name} and the package rejects it too`, () => {
      const doc = oneShot()
      mutate(doc)
      expect(codes(doc)).toContain(code)
      expect(validateWorkflow(doc)).toBe(false)
    })
  }

  it('flags a cycle that never reaches Finish (runtime-only rule)', () => {
    const doc = oneShot()
    doc.attributes.states.push(
      { key: 'loop-a', stateType: 2, transitions: [{ key: 'to-b', target: 'loop-b', triggerType: 1, versionStrategy: 'Major' }] },
      { key: 'loop-b', stateType: 2, transitions: [{ key: 'to-a', target: 'loop-a', triggerType: 1, versionStrategy: 'Major' }] },
    )
    const stuck = historyNoneIssues(doc).filter((i) => i.code === 'history.cannotFinish').map((i) => i.stateKey)
    expect(stuck).toEqual(['loop-a', 'loop-b'])
  })

  it('ignores full-history flows', () => {
    const doc = oneShot()
    doc.attributes.history = 'full'
    doc.attributes.states[0]!.stateType = 5
    expect(historyNoneIssues(doc)).toEqual([])
  })

  it('lists SubFlow children but not SubProcess ones', () => {
    const doc = oneShot()
    doc.attributes.states.push(
      { key: 'sf', stateType: 4, subFlow: { type: 'S', process: { key: 'child', domain: 'core' } } },
      { key: 'sp', stateType: 4, subFlow: { type: 'P', process: { key: 'proc' } } },
    )
    expect(subFlowChildRefs(doc)).toEqual([{ stateKey: 'sf', key: 'child', domain: 'core' }])
  })
})
