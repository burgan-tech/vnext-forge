export interface FilterableColumn {
  id: string
  label: string
  type: 'text' | 'select' | 'date'
  options?: { label: string; value: string }[]
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

export interface DataTablePaginationState {
  page: number
  pageSize: number
  hasNext: boolean
  totalCount?: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}
