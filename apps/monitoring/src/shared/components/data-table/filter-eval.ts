import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOperator,
  FilterableColumn,
} from './types'

// ---------------------------------------------------------------------------
// Node factories — stable ids for React keys + tree edits
// ---------------------------------------------------------------------------

let _seq = 0
const uid = () => `fn${(_seq += 1)}`

export function createEmptyFilterRoot(): FilterGroup {
  return { kind: 'group', id: 'root', combinator: 'and', children: [] }
}

export function defaultOperatorFor(col: FilterableColumn): FilterOperator {
  if (col.graphqlOperators && col.graphqlOperators.length > 0) return col.graphqlOperators[0]
  if (col.type === 'select' || col.type === 'boolean') return 'eq'
  if (col.type === 'date') return 'gt'
  return 'contains'
}

export function operatorsFor(col: FilterableColumn): FilterOperator[] {
  if (col.graphqlOperators && col.graphqlOperators.length > 0) return col.graphqlOperators
  if (col.type === 'boolean') return ['eq', 'ne']
  if (col.type === 'select') return ['eq', 'ne', 'in', 'nin']
  if (col.type === 'date') return ['gt', 'ge', 'lt', 'le']
  return ['contains', 'eq', 'ne', 'startswith', 'endswith', 'in']
}

export function createCondition(column: FilterableColumn): FilterCondition {
  return {
    kind: 'condition',
    id: uid(),
    columnId: column.id,
    operator: defaultOperatorFor(column),
    value: '',
  }
}

export function createGroup(): FilterGroup {
  return { kind: 'group', id: uid(), combinator: 'and', children: [] }
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

/** Count effective (non-empty) conditions anywhere in the tree. */
export function countConditions(node: FilterNode): number {
  if (node.kind === 'condition') return node.value.trim() ? 1 : 0
  return node.children.reduce((sum, child) => sum + countConditions(child), 0)
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function matchCondition(cond: FilterCondition, getValue: (columnId: string) => unknown): boolean {
  // An empty value is "not yet applied" → never constrains the result.
  if (!cond.value.trim()) return true
  const val = String(getValue(cond.columnId) ?? '').toLowerCase()
  const fval = cond.value.trim().toLowerCase()
  switch (cond.operator) {
    case 'eq':       return val === fval
    case 'ne':       return val !== fval
    case 'contains': return val.includes(fval)
    case 'startswith': return val.startsWith(fval)
    case 'endswith': return val.endsWith(fval)
    case 'in':       return fval.split(',').map((v) => v.trim()).some((v) => val === v)
    case 'nin':      return fval.split(',').map((v) => v.trim()).every((v) => val !== v)
    case 'gt':       return val > fval
    case 'ge':       return val >= fval
    case 'lt':       return val < fval
    case 'le':       return val <= fval
    default:         return true
  }
}

/**
 * Evaluate a filter node against a single row.
 * `getValue` resolves a columnId to that row's raw cell value.
 * Empty conditions and empty groups are pass-through (return true).
 */
export function evaluateFilterNode(
  node: FilterNode,
  getValue: (columnId: string) => unknown,
): boolean {
  if (node.kind === 'condition') return matchCondition(node, getValue)

  // Only children that actually constrain anything participate.
  const effective = node.children.filter((child) => countConditions(child) > 0)
  if (effective.length === 0) return true

  return node.combinator === 'and'
    ? effective.every((child) => evaluateFilterNode(child, getValue))
    : effective.some((child) => evaluateFilterNode(child, getValue))
}
