import { describe, expect, it } from 'vitest'

import { locateJsonProperty, offsetToPosition, removePropertyRange } from '../src/internal/json-locate.js'

const DOC = `{
  "key": "orders",
  "attributes": {
    "labels": [{ "type": "nope" }],
    "type": "schema",
    "schema": { "type": "object", "properties": {} }
  }
}
`

describe('locateJsonProperty', () => {
  it('finds a nested scalar without matching same-named keys deeper or in arrays', () => {
    const loc = locateJsonProperty(DOC, ['attributes', 'type'])!
    expect(DOC.slice(loc.propertyStart, loc.propertyEnd)).toBe('"type": "schema"')
    expect(DOC.slice(loc.valueStart, loc.valueEnd)).toBe('"schema"')
    expect(offsetToPosition(DOC, loc.valueStart)).toEqual({ line: 4, character: 12 })
  })

  it('finds container values', () => {
    const loc = locateJsonProperty(DOC, ['attributes', 'schema'])!
    expect(DOC.slice(loc.valueStart, loc.valueEnd)).toBe('{ "type": "object", "properties": {} }')
  })

  it('handles escaped strings and scalars', () => {
    const text = '{"a":"x\\"}","b":true,"c":{"d":12.5}}'
    expect(text.slice(...range(locateJsonProperty(text, ['c', 'd'])!))).toBe('12.5')
    expect(text.slice(...range(locateJsonProperty(text, ['b'])!))).toBe('true')
  })

  it('returns null when absent', () => {
    expect(locateJsonProperty(DOC, ['attributes', 'missing'])).toBeNull()
    expect(locateJsonProperty('{"a":1}', ['a', 'b'])).toBeNull()
  })
})

describe('removePropertyRange', () => {
  const apply = (text: string, path: string[]) => {
    const { start, end } = removePropertyRange(text, locateJsonProperty(text, path)!)
    return text.slice(0, start) + text.slice(end)
  }

  it('removes a line-separated property with its comma', () => {
    const out = apply(DOC, ['attributes', 'type'])
    expect(JSON.parse(out).attributes).not.toHaveProperty('type')
    expect(out).toContain('    "labels": [{ "type": "nope" }],\n    "schema"')
  })

  it('removes the last property and the preceding comma', () => {
    const out = apply('{"a":1, "type":"x"}', ['type'])
    expect(out).toBe('{"a":1}')
  })

  it('removes an inline middle property', () => {
    expect(JSON.parse(apply('{"a":1, "type":"x", "b":2}', ['type']))).toEqual({ a: 1, b: 2 })
  })
})

function range(loc: { valueStart: number; valueEnd: number }): [number, number] {
  return [loc.valueStart, loc.valueEnd]
}
