import type { FilterCondition, FilterGroup, FilterNode, FilterableColumn } from './types'

type BackendFilter = Record<string, unknown>

function serializeCondition(
  cond: FilterCondition,
  colMap: Map<string, FilterableColumn>,
): BackendFilter | null {
  const { columnId, operator, value } = cond

  if (!value.trim()) return null

  const col = colMap.get(columnId)

  // in / nin: comma-separated string → array
  if (operator === 'in' || operator === 'nin') {
    const arr = value.split(',').map((v) => v.trim()).filter(Boolean)
    if (!arr.length) return null
    return { [columnId]: { [operator]: arr } }
  }

  // boolean columns: "true"/"false" → JSON boolean
  if (col?.type === 'boolean') {
    return { [columnId]: { [operator]: value.trim() === 'true' } }
  }

  // 'contains' in the UI maps to 'like' in the backend filter spec
  const backendOp = operator === 'contains' ? 'like' : operator

  return { [columnId]: { [backendOp]: value.trim() } }
}

function serializeNode(
  node: FilterNode,
  colMap: Map<string, FilterableColumn>,
): BackendFilter | null {
  if (node.kind === 'condition') return serializeCondition(node, colMap)

  const children = node.children
    .map((child) => serializeNode(child, colMap))
    .filter((x): x is BackendFilter => x !== null)

  if (children.length === 0) return null
  if (children.length === 1) return children[0]

  return { [node.combinator]: children }
}

/**
 * Converts a FilterGroup tree into the backend JSON filter string.
 * Returns null when no effective conditions exist.
 *
 * Backend format: {"field":{"operator":"value"}} or {"and":[...]} / {"or":[...]}
 * The 'contains' operator maps to 'like'; 'in'/'nin' values become arrays.
 */
export function filterGroupToJson(
  root: FilterGroup,
  columns: FilterableColumn[] = [],
): string | null {
  const colMap = new Map(columns.map((c) => [c.id, c]))
  const result = serializeNode(root, colMap)
  if (!result) return null
  return JSON.stringify(result)
}
