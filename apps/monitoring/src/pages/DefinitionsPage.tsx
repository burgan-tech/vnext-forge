import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useDebounce } from '@monitoring/shared/lib/useDebounce';
import { ComponentBadgeIcon } from '@monitoring/shared/components/ComponentBadgeIcon';
import {
  DataTable,
  type FilterableColumn,
  type QueryParamFilters,
  useTableUrlState,
  validateQueryParamFilters,
} from '@monitoring/shared/components/data-table';
import { useDefinitionList, type DefinitionType } from '@monitoring/modules/definitions/api/definitions-queries';
import { getDefinitionColumns } from '@monitoring/modules/definitions/components/definition-columns';
import type { DefinitionListItem } from '@monitoring/shared/types/definitions-api';

// ---------------------------------------------------------------------------
// Per-type filterable columns — sent as query params to the API
//
// Common fields (all types): version, flowVersion, tags, createdAt/modifiedAt ranges
// Type-specific fields per backend ComponentFilterDescriptor allowlist
// ---------------------------------------------------------------------------

const COMMON_COLUMNS: FilterableColumn[] = [
  { id: 'version',     label: 'Version',      type: 'text', operators: ['eq', 'contains'] },
  { id: 'flowVersion', label: 'Flow Version',  type: 'text', operators: ['eq', 'contains'] },
  { id: 'tags',        label: 'Tag',           type: 'text', operators: ['contains'] },
  { id: 'createdAt',   label: 'Created At',    type: 'date' },
  { id: 'modifiedAt',  label: 'Modified At',   type: 'date' },
]

// Scope options: API blob stores raw D/F/I values.
// NOTE: see docs/ask-correctness/2026-06-19-scope-enum-values.md
const SCOPE_OPTIONS = [
  { label: 'Domain',   value: 'D' },
  { label: 'Flow',     value: 'F' },
  { label: 'Instance', value: 'I' },
]

const FILTERABLE_COLUMNS: Record<DefinitionType, FilterableColumn[]> = {
  workflow: [
    ...COMMON_COLUMNS,
    {
      id: 'definitionType', label: 'Type', type: 'select', options: [
        { label: 'Flow',       value: 'F' },
        { label: 'Core',       value: 'C' },
        { label: 'SubFlow',    value: 'S' },
        { label: 'SubProcess', value: 'P' },
      ],
    },
  ],
  task: [
    ...COMMON_COLUMNS,
    // NOTE: definitionType is matched against the blob "type" field via MatchBlobString.
    // If the backend stores task types as numbers (not strings), this filter may not work.
    // See docs/ask-correctness/2026-06-19-definitiontype-numeric-blob.md
    {
      id: 'definitionType', label: 'Task Type', type: 'select', options: [
        { label: 'DaprHttpEndpoint',     value: '1' },
        { label: 'DaprBinding',          value: '2' },
        { label: 'DaprService',          value: '3' },
        { label: 'DaprPubSub',           value: '4' },
        { label: 'HumanTask',            value: '5' },
        { label: 'HttpTask',             value: '6' },
        { label: 'ScriptTask',           value: '7' },
        { label: 'ConditionTask',        value: '8' },
        { label: 'TimerTask',            value: '9' },
        { label: 'NotificationTask',     value: '10' },
        { label: 'StartFlowTask',        value: '11' },
        { label: 'TriggerTransitionTask',value: '12' },
        { label: 'GetInstanceDataTask',  value: '13' },
        { label: 'SubProcessTask',       value: '14' },
        { label: 'GetInstancesTask',     value: '15' },
        { label: 'SoapTask',             value: '16' },
      ],
    },
  ],
  function: [
    ...COMMON_COLUMNS,
    { id: 'scope', label: 'Scope', type: 'select', options: SCOPE_OPTIONS },
  ],
  view: [
    ...COMMON_COLUMNS,
    // NOTE: same MatchBlobString numeric concern as tasks
    // See docs/ask-correctness/2026-06-19-definitiontype-numeric-blob.md
    {
      id: 'definitionType', label: 'View Type', type: 'select', options: [
        { label: 'JSON',     value: '1' },
        { label: 'HTML',     value: '2' },
        { label: 'Markdown', value: '3' },
        { label: 'Deeplink', value: '4' },
        { label: 'Http',     value: '5' },
        { label: 'URN',      value: '6' },
      ],
    },
    { id: 'display',   label: 'Display',   type: 'text' },
    { id: 'renderer',  label: 'Renderer',  type: 'text' },
  ],
  extension: [
    ...COMMON_COLUMNS,
    { id: 'definitionType', label: 'Type',  type: 'text' },
    { id: 'scope',          label: 'Scope', type: 'select', options: SCOPE_OPTIONS },
  ],
  schema: [
    ...COMMON_COLUMNS,
    { id: 'definitionType', label: 'Type', type: 'text' },
  ],
  mapping: [
    ...COMMON_COLUMNS,
    { id: 'name', label: 'Name', type: 'text', operators: ['eq', 'contains'] },
  ],
};

// ---------------------------------------------------------------------------
// DefinitionsPage
// ---------------------------------------------------------------------------

export function DefinitionsPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();

  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [queryParamFilters, setQueryParamFilters] = useState<QueryParamFilters>({});

  const defType = (type ?? 'workflow') as DefinitionType;

  // Debounce search input — 350ms before sending to the backend as `key` query param
  const search = useDebounce(searchDraft, 750);

  // Reset state when the component type ACTUALLY changes. We compare against the
  // previous value rather than skipping a run count: under React StrictMode the
  // component mounts twice and effects re-run while refs persist, so a run-count
  // guard would clear state that the URL just hydrated on the second mount. A
  // value compare clears only on a genuine type switch.
  const prevDefType = useRef(defType);
  useEffect(() => {
    if (prevDefType.current === defType) return;
    prevDefType.current = defType;
    /* eslint-disable react-hooks/set-state-in-effect, react-x/set-state-in-effect */
    setPage(1);
    setSearchDraft('');
    setQueryParamFilters({});
    /* eslint-enable react-hooks/set-state-in-effect, react-x/set-state-in-effect */
  }, [defType]);

  // Reset to page 1 when the debounced search term ACTUALLY changes. Same
  // value-compare approach (StrictMode-safe). The one transition that matches a
  // hydrated search restore is skipped so a restored page survives.
  const prevSearch = useRef(search);
  const hydratedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSearch.current === search) return;
    prevSearch.current = search;
    if (hydratedSearchRef.current !== null && search === hydratedSearchRef.current) {
      hydratedSearchRef.current = null;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-x/set-state-in-effect
    setPage(1);
  }, [search]);

  // Merge panel filters with key[contains] search — bracket notation for filter mode
  const apiFilters = useMemo(() => {
    if (!search) return queryParamFilters;
    return { ...queryParamFilters, 'key[contains]': search };
  }, [queryParamFilters, search]);

  const urlFilterColumns = FILTERABLE_COLUMNS[defType] ?? [];
  useTableUrlState({
    tableId: `definitions-${defType}`,
    mode: 'query-param',
    state: {
      f: Object.keys(queryParamFilters).length > 0 ? queryParamFilters : undefined,
      q: search,
      p: page,
    },
    onHydrate: (decoded) => {
      if (decoded.f) {
        setQueryParamFilters(validateQueryParamFilters(decoded.f, urlFilterColumns) as QueryParamFilters);
      }
      if (typeof decoded.q === 'string') {
        hydratedSearchRef.current = decoded.q;
        setSearchDraft(decoded.q);
      }
      if (typeof decoded.p === 'number') setPage(decoded.p);
    },
  });

  const { data, isLoading, isError } = useDefinitionList(defType, page, pageSize, apiFilters);

  const columns = useMemo(() => getDefinitionColumns(defType), [defType]);
  const filterableColumns = FILTERABLE_COLUMNS[defType] ?? [];

  const displayName = defType.charAt(0).toUpperCase() + defType.slice(1) + 's';
  const hasNext = page < (data?.totalPages ?? 1);
  const hasActiveFilters = !!search || Object.values(queryParamFilters).some(Boolean);

  function handleRowClick(row: DefinitionListItem) {
    navigate(`/definitions/${defType}/${row.id}`);
  }

  function handleFiltersChange(filters: QueryParamFilters) {
    setQueryParamFilters(filters);
    setPage(1);
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
        data={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage={`Failed to load ${defType}s.`}
        emptyMessage={
          search || hasActiveFilters
            ? `No ${defType}s match the current filters`
            : `No ${defType}s found`
        }
        onRowClick={handleRowClick}
        pagination={{
          page,
          pageSize,
          hasNext,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
          pageSizeOptions: [10, 20, 50],
        }}
        toolbarContent={toolbarContent}
        filterableColumns={filterableColumns}
        filterMode="query-param"
        queryParamFilters={queryParamFilters}
        onQueryParamFiltersChange={handleFiltersChange}
      />
    </div>
  );
}
