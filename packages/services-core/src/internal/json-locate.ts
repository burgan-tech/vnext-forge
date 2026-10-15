/**
 * Offsets of one object property in a JSON text, found without re-serialising
 * so callers can edit just that property (keeping the author's formatting) or
 * point a diagnostic at it.
 */
export interface JsonPropertyLocation {
  /** Offset of the opening quote of the property name. */
  propertyStart: number
  /** Offset just past the value. */
  propertyEnd: number
  valueStart: number
  valueEnd: number
}

/** 0-based line / character for `offset`, as editors count them. */
export function offsetToPosition(text: string, offset: number): { line: number; character: number } {
  let line = 0
  let lineStart = 0
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      lineStart = i + 1
    }
  }
  return { line, character: offset - lineStart }
}

interface Frame {
  kind: 'object' | 'array'
  /** Path of this container. */
  path: string[]
  /** Object: name of the property whose value comes next. */
  pendingKey?: string
  pendingKeyStart?: number
  /** Array: index of the next element. */
  index: number
}

/**
 * Locates the property at `path` (object keys only, e.g.
 * `['attributes', 'type']`). Returns `null` when it is absent or the text is
 * not well-formed enough to tell.
 */
export function locateJsonProperty(text: string, path: readonly string[]): JsonPropertyLocation | null {
  if (path.length === 0) return null
  const stack: Frame[] = []
  let i = 0
  let expectingKey = false
  // Assigned inside closures, so TS must not narrow it to `null` here.
  let target = null as { start: number; valueStart: number } | null

  const samePath = (candidate: string[]) =>
    candidate.length === path.length && candidate.every((segment, n) => segment === path[n])

  /** Path of the value about to start, and its property start when it is the target. */
  const beginValue = (valueStart: number): string[] | null => {
    const top = stack[stack.length - 1]
    if (!top) return []
    if (top.kind === 'array') return [...top.path, String(top.index)]
    if (top.pendingKey === undefined) return null
    const valuePath = [...top.path, top.pendingKey]
    if (samePath(valuePath) && top.pendingKeyStart !== undefined) {
      target = { start: top.pendingKeyStart, valueStart }
    }
    return valuePath
  }

  const endValue = (valueEnd: number): JsonPropertyLocation | null => {
    const top = stack[stack.length - 1]
    if (top?.kind === 'array') top.index++
    if (top?.kind === 'object') {
      top.pendingKey = undefined
      top.pendingKeyStart = undefined
    }
    if (target && stack.length === path.length) {
      return { propertyStart: target.start, propertyEnd: valueEnd, valueStart: target.valueStart, valueEnd }
    }
    return null
  }

  const readString = (start: number): number => {
    let j = start + 1
    while (j < text.length) {
      const c = text[j]
      if (c === '\\') j += 2
      else if (c === '"') return j + 1
      else j++
    }
    return -1
  }

  while (i < text.length) {
    const c = text[i]!
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === ',' || c === ':') {
      if (c === ',' && stack[stack.length - 1]?.kind === 'object') expectingKey = true
      i++
      continue
    }
    if (c === '{' || c === '[') {
      const valuePath = beginValue(i)
      if (valuePath === null) return null
      stack.push({ kind: c === '{' ? 'object' : 'array', path: valuePath, index: 0 })
      expectingKey = c === '{'
      i++
      continue
    }
    if (c === '}' || c === ']') {
      const closed = stack.pop()
      if (!closed) return null
      i++
      // A container value ends here; it is the target when its path matches.
      if (samePath(closed.path) && target) {
        return { propertyStart: target.start, propertyEnd: i, valueStart: target.valueStart, valueEnd: i }
      }
      const top = stack[stack.length - 1]
      if (top?.kind === 'array') top.index++
      if (top?.kind === 'object') {
        top.pendingKey = undefined
        top.pendingKeyStart = undefined
      }
      expectingKey = false
      continue
    }
    if (c === '"') {
      const end = readString(i)
      if (end < 0) return null
      const top = stack[stack.length - 1]
      if (expectingKey && top?.kind === 'object') {
        try {
          top.pendingKey = JSON.parse(text.slice(i, end)) as string
        } catch {
          return null
        }
        top.pendingKeyStart = i
        expectingKey = false
        i = end
        continue
      }
      if (beginValue(i) === null) return null
      const found = endValue(end)
      if (found) return found
      i = end
      continue
    }
    // Scalar: number, true, false, null.
    let j = i
    while (j < text.length && !/[\s,}\]]/.test(text[j]!)) j++
    if (j === i) return null
    if (beginValue(i) === null) return null
    const found = endValue(j)
    if (found) return found
    i = j
  }
  return null
}

/**
 * Text edit that removes the property at `location`, together with the comma
 * that separates it from a neighbour, so the object stays valid JSON.
 */
export function removePropertyRange(
  text: string,
  location: JsonPropertyLocation,
): { start: number; end: number } {
  let j = location.propertyEnd
  while (j < text.length && /\s/.test(text[j]!)) j++
  if (text[j] === ',') {
    // Drop the trailing comma; when the property sits on its own line, drop
    // the whole line so the next property keeps its indentation.
    j++
    while (j < text.length && /[ \t]/.test(text[j]!)) j++
    if (text[j] === '\r') j++
    if (text[j] === '\n') j++
    let start = location.propertyStart
    while (start > 0 && /[ \t]/.test(text[start - 1]!)) start--
    return { start, end: j }
  }
  // Last property: drop the preceding comma instead.
  let start = location.propertyStart
  let k = start - 1
  while (k >= 0 && /\s/.test(text[k]!)) k--
  if (text[k] === ',') start = k
  return { start, end: location.propertyEnd }
}
