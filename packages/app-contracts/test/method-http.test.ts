import { describe, expect, it } from 'vitest'

import {
  METHOD_HTTP_METADATA,
  type MethodHttpVerb,
  listMethodHttpSpecs,
  type MethodId,
} from '../src/method-http.ts'

const VERBS: ReadonlySet<MethodHttpVerb> = new Set(['GET', 'POST', 'PUT', 'DELETE'])

describe('METHOD_HTTP_METADATA', () => {
  it('has 30 entries', () => {
    expect(Object.keys(METHOD_HTTP_METADATA)).toHaveLength(30)
  })

  it('uses only valid HTTP verbs', () => {
    for (const spec of Object.values(METHOD_HTTP_METADATA)) {
      expect(VERBS.has(spec.verb)).toBe(true)
    }
  })

  it('listMethodHttpSpecs matches the frozen map', () => {
    const listed = listMethodHttpSpecs()
    expect(listed).toHaveLength(30)
    const fromList = new Map(listed.map((row) => [row.method, row.spec]))
    for (const id of Object.keys(METHOD_HTTP_METADATA) as MethodId[]) {
      expect(fromList.get(id)).toEqual(METHOD_HTTP_METADATA[id])
    }
  })
})
