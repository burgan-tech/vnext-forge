import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DataTable } from './DataTable'

const columns = [
  { id: 'name', header: 'Name', accessorKey: 'name' },
  { id: 'status', header: 'Status', accessorKey: 'status' },
]

describe('DataTable loading state', () => {
  it('renders skeleton rows instead of a Loading… text row', () => {
    const html = renderToStaticMarkup(
      h(DataTable, { tableId: 't', columns: columns as never, data: [], isLoading: true }),
    )
    expect(html).not.toContain('Loading…')
    const skeletonCount = (html.match(/data-slot="skeleton"/g) ?? []).length
    expect(skeletonCount).toBeGreaterThanOrEqual(10) // 5 rows × 2 columns
  })

  it('dims the body while refetching with data present', () => {
    const html = renderToStaticMarkup(
      h(DataTable, {
        tableId: 't',
        columns: columns as never,
        data: [{ name: 'a', status: 'ok' }] as never,
        isFetching: true,
      }),
    )
    expect(html).toMatch(/<tbody[^>]*opacity-60/)
  })

  it('does not dim while the first page loads — the skeleton state wins', () => {
    const html = renderToStaticMarkup(
      h(DataTable, {
        tableId: 't',
        columns: columns as never,
        data: [],
        isLoading: true,
        isFetching: true,
      }),
    )
    expect(html).not.toMatch(/<tbody[^>]*opacity-60/)
    expect(html).not.toContain('opacity-60')
    expect(html).toContain('data-slot="skeleton"')
  })
})
