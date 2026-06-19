export interface FilterableColumn {
  id: string
  label: string
  type: 'text' | 'select' | 'date' | 'boolean'
  options?: { label: string; value: string }[]
  /**
   * Query-param mode only. Lists the bracket operators the backend accepts for this field.
   * - ['eq']           → always sends `field[eq]=value`, shows fixed "is"
   * - ['contains']     → always sends `field[contains]=value`, shows fixed "contains"
   * - ['eq','contains']→ user picks; shows an operator dropdown
   * Omit for plain params and for select/date columns.
   */
  operators?: Array<'eq' | 'contains'>
  /**
   * GraphQL filter-builder mode only. Overrides the default operator list from operatorsFor(type).
   * Use when a column's backend operator set differs from its type's default.
   */
  graphqlOperators?: FilterOperator[]
}

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'in'
  | 'nin'
  | 'gt'
  | 'ge'
  | 'lt'
  | 'le'

// ---------------------------------------------------------------------------
// Filter tree — GraphQL-style nestable AND/OR groups
// ---------------------------------------------------------------------------

export interface FilterCondition {
  kind: 'condition'
  id: string
  columnId: string
  operator: FilterOperator
  value: string
}

export interface FilterGroup {
  kind: 'group'
  id: string
  combinator: 'and' | 'or'
  children: FilterNode[]
}

export type FilterNode = FilterCondition | FilterGroup

// ---------------------------------------------------------------------------
// Query-param filter — flat key/value map sent as REST query parameters
// ---------------------------------------------------------------------------

export type QueryParamFilters = Record<string, string>

export interface DataTablePaginationState {
  page: number
  pageSize: number
  hasNext: boolean
  totalCount?: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}
