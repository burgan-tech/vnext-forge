import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useDebounce } from '@monitoring/shared/lib/useDebounce';
import { ComponentBadgeIcon } from '@monitoring/shared/components/ComponentBadgeIcon';
import {
  DataTable,
  createEmptyFilterRoot,
  evaluateFilterNode,
  countConditions,
  type FilterableColumn,
  type FilterGroup,
} from '@monitoring/shared/components/data-table';
import { useDefinitionList, type DefinitionType } from '@monitoring/modules/definitions/api/definitions-queries';
import { getDefinitionColumns } from '@monitoring/modules/definitions/components/definition-columns';
import type { DefinitionListItem } from '@monitoring/shared/types/definitions-api';

// ---------------------------------------------------------------------------
// Per-type filterable columns (applied client-side on current page)
// ---------------------------------------------------------------------------

const FILTERABLE_COLUMNS: Record<DefinitionType, FilterableColumn[]> = {
  workflow: [
    { id: 'domain', label: 'Domain', type: 'text' },
    { id: 'version', label: 'Version', type: 'text' },
    {
      id: 'type', label: 'Type', type: 'select', options: [
        { label: 'Flow', value: 'F' },
        { label: 'Core', value: 'C' },
        { label: 'SubFlow', value: 'S' },
        { label: 'SubProcess', value: 'P' },
      ],
    },
  ],
  task: [
    { id: 'domain', label: 'Domain', type: 'text' },
    { id: 'version', label: 'Version', type: 'text' },
  ],
  function: [
    { id: 'domain', label: 'Domain', type: 'text' },
    { id: 'version', label: 'Version', type: 'text' },
    {
      id: 'scope', label: 'Scope', type: 'select', options: [
        { label: 'Domain', value: 'Domain' },
        { label: 'Flow', value: 'Flow' },
        { label: 'Instance', value: 'Instance' },
      ],
    },
  ],
  extension: [
    { id: 'domain', label: 'Domain', type: 'text' },
    { id: 'version', label: 'Version', type: 'text' },
    {
      id: 'scope', label: 'Scope', type: 'select', options: [
        { label: 'Domain', value: 'Domain' },
        { label: 'Flow', value: 'Flow' },
        { label: 'Instance', value: 'Instance' },
      ],
    },
  ],
  schema: [
    { id: 'domain', label: 'Domain', type: 'text' },
    { id: 'version', label: 'Version', type: 'text' },
  ],
  view: [
    { id: 'domain', label: 'Domain', type: 'text' },
    { id: 'version', label: 'Version', type: 'text' },
  ],
  mapping: [
    { id: 'domain', label: 'Domain', type: 'text' },
    { id: 'version', label: 'Version', type: 'text' },
  ],
};

// ---------------------------------------------------------------------------
// Client-side filter application
// ---------------------------------------------------------------------------

function applyFilters(items: DefinitionListItem[], root: FilterGroup): DefinitionListItem[] {
  if (countConditions(root) === 0) return items;
  return items.filter((item) =>
    evaluateFilterNode(root, (columnId) => (item as unknown as Record<string, unknown>)[columnId]),
  );
}

// ---------------------------------------------------------------------------
// DefinitionsPage
// ---------------------------------------------------------------------------

export function DefinitionsPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();

  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterRoot, setFilterRoot] = useState<FilterGroup>(createEmptyFilterRoot());

  const defType = (type ?? 'workflow') as DefinitionType;

  // Debounce client-side search — 350ms so we don't filter on every keystroke
  const search = useDebounce(searchDraft, 350);

  // Reset state when component type changes
  useEffect(() => {
    setPage(1);
    setSearchDraft('');
    setFilterRoot(createEmptyFilterRoot());
  }, [defType]);

  const { data, isLoading, isError } = useDefinitionList(defType, page, pageSize);

  // Client-side search + filter on current page data
  const filtered = useMemo(() => {
    let result = data?.items ?? [];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
      );
    }
    return applyFilters(result, filterRoot);
  }, [data?.items, search, filterRoot]);

  const columns = useMemo(() => getDefinitionColumns(defType), [defType]);
  const filterableColumns = FILTERABLE_COLUMNS[defType] ?? [];

  const displayName = defType.charAt(0).toUpperCase() + defType.slice(1) + 's';

  // hasNext: use totalPages estimate from query (no totalCount passed to pagination → Prev/Next only)
  const hasNext = page < (data?.totalPages ?? 1);

  function handleRowClick(row: DefinitionListItem) {
    navigate(`/definitions/${defType}/${row.id}`);
  }

  const toolbarContent = (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        placeholder="Search key…"
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
        className="h-9 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
          <ComponentBadgeIcon
            type={defType}
            className="h-8 w-8 self-center text-muted-foreground"
            colored={false}
          />
          <span className="leading-none">{displayName}</span>
        </h1>
      </div>

      <DataTable
        tableId={`definitions-${defType}`}
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        isError={isError}
        errorMessage={`Failed to load ${defType}s.`}
        emptyMessage={
          search || countConditions(filterRoot)
            ? `No ${defType}s match the current filters`
            : `No ${defType}s found`
        }
        onRowClick={handleRowClick}
        pagination={{
          page,
          pageSize,
          hasNext,
          // totalCount intentionally omitted → shows Prev/Next only (no numeric pages)
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
          pageSizeOptions: [10, 20, 50],
        }}
        toolbarContent={toolbarContent}
        filterableColumns={filterableColumns}
        filterRoot={filterRoot}
        onFilterRootChange={(r) => { setFilterRoot(r); setPage(1); }}
      />
    </div>
  );
}
