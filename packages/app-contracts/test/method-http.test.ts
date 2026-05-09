import { describe, expect, it } from 'vitest'

import {
  METHOD_HTTP_METADATA,
  type MethodHttpVerb,
  listMethodHttpSpecs,
  type MethodId,
} from '../src/method-http.ts'

const VERBS: ReadonlySet<MethodHttpVerb> = new Set(['GET', 'POST', 'PUT', 'DELETE'])

describe('METHOD_HTTP_METADATA', () => {
  it('has unique method ids', () => {
    const keys = Object.keys(METHOD_HTTP_METADATA)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses only valid HTTP verbs', () => {
    for (const spec of Object.values(METHOD_HTTP_METADATA)) {
      expect(VERBS.has(spec.verb)).toBe(true)
    }
  })

  it('listMethodHttpSpecs matches the frozen map', () => {
    const keys = Object.keys(METHOD_HTTP_METADATA)
    const listed = listMethodHttpSpecs()
    expect(listed).toHaveLength(keys.length)
    const fromList = new Map(listed.map((row) => [row.method, row.spec]))
    for (const id of keys as MethodId[]) {
      expect(fromList.get(id)).toEqual(METHOD_HTTP_METADATA[id])
    }
  })
})
