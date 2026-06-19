export interface FilterableColumn {
  id: string
  label: string
  type: 'text' | 'select' | 'date'
  options?: { label: string; value: string }[]
  /**
   * Text columns only. Lists the bracket operators the backend accepts for this field.
   * - ['eq']           → always sends `field[eq]=value`,  shows fixed "is"
   * - ['contains']     → always sends `field[contains]=value`, shows fixed "contains"
   * - ['eq','contains']→ user picks; shows an operator dropdown
   * Omit for plain params (e.g. `?version=`) and for select/date columns.
   */
  operators?: Array<'eq' | 'contains'>
}

export type FilterOperator = 'eq' | 'contains' | 'gt' | 'lt'

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
