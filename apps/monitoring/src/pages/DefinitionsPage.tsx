import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';

import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { useDefinitionList, type DefinitionType } from '@monitoring/modules/definitions/api/definitions-queries';
import { Pagination } from '@monitoring/shared/components/Pagination';
import type { DefinitionListItem, ApiComponentLabel } from '@monitoring/shared/types/definitions-api';

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  F: 'Flow',
  C: 'Core',
  S: 'SubFlow',
  P: 'SubProcess',
};
const WORKFLOW_TYPE_VARIANTS: Record<string, 'info' | 'warning' | 'secondary' | 'success'> = {
  F: 'info',
  C: 'success',
  S: 'warning',
  P: 'secondary',
};

const SCOPE_VARIANTS: Record<string, 'info' | 'warning' | 'secondary' | 'success'> = {
  D: 'info',
  F: 'warning',
  I: 'success',
};

// Helper: pick best label (en-US → tr-TR → en prefix → tr prefix → first)
function getLabel(labels?: ApiComponentLabel[]): string {
  if (!labels?.length) return '—';
  return (
    labels.find((l) => l.language === 'en-US')?.label ??
    labels.find((l) => l.language === 'tr-TR')?.label ??
    labels.find((l) => l.language.startsWith('en'))?.label ??
    labels.find((l) => l.language.startsWith('tr'))?.label ??
    labels[0]?.label ??
    '—'
  );
}

function WorkflowRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground font-mono text-sm">{item.id}</td>
      <td className="px-4 py-3">
        <Badge variant={WORKFLOW_TYPE_VARIANTS[item.type ?? 'F'] ?? 'secondary'} className="font-mono text-xs">
          {WORKFLOW_TYPE_LABELS[item.type ?? ''] ?? item.type ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.domain}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{getLabel(item.labels)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
    </>
  );
}

function TaskRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground font-mono text-sm">{item.id}</td>
      <td className="px-4 py-3">
        <Badge variant={item.taskType === 'Http' ? 'info' : 'secondary'} className="font-mono text-xs">
          {item.taskType ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.domain}</td>
      <td className="px-4 py-3">
        {item.deprecated && (
          <Badge variant="destructive" className="text-xs">
            Deprecated
          </Badge>
        )}
      </td>
    </>
  );
}

function FunctionRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground font-mono text-sm">{item.id}</td>
      <td className="px-4 py-3">
        <Badge variant={SCOPE_VARIANTS[item.scope ?? ''] ?? 'secondary'} className="font-mono text-xs">
          {item.scope ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{getLabel(item.labels)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
    </>
  );
}

function MappingRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground font-mono text-sm">{item.id}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.usedBy?.join(', ') || '—'}</td>
    </>
  );
}

function ExtensionRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground font-mono text-sm">{item.id}</td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="font-mono text-xs">
          {item.type ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={SCOPE_VARIANTS[item.scope ?? ''] ?? 'secondary'} className="font-mono text-xs">
          {item.scope ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{getLabel(item.labels)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
    </>
  );
}

function SchemaRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground font-mono text-sm">{item.id}</td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="font-mono text-xs">
          {item.type ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{getLabel(item.labels)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
    </>
  );
}

function ViewRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground font-mono text-sm">{item.id}</td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="font-mono text-xs">
          {item.type ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="font-mono text-xs">
          {item.display ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="font-mono text-xs">
          {item.renderer ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{getLabel(item.labels)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
    </>
  );
}

function DefaultRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground font-mono text-sm">{item.id}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
      <td className="px-4 py-3" />
    </>
  );
}

const HEADERS: Record<string, string[]> = {
  workflow: ['Key', 'Type', 'Version', 'Domain', 'Labels', 'Description'],
  task: ['Key', 'Type', 'Version', 'Domain', 'Status'],
  function: ['Key', 'Scope', 'Version', 'Labels', 'Description'],
  mapping: ['Key', 'Version', 'Description', 'Used By'],
  extension: ['Key', 'Type', 'Scope', 'Labels', 'Description'],
  schema: ['Key', 'Type', 'Version', 'Labels', 'Description'],
  view: ['Key', 'Type', 'Display', 'Renderer', 'Labels', 'Description'],
  default: ['Key', 'Version', 'Description', ''],
};

export function DefinitionsPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const defType = (type ?? 'workflow') as DefinitionType;

  // Reset to page 1 when type, search, or pageSize changes
  useEffect(() => { setPage(1); }, [defType]);
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { setPage(1); }, [pageSize]);

  const { data, isLoading } = useDefinitionList(defType, page, pageSize);

  const allItems = data?.items ?? [];
  const filtered = search
    ? allItems.filter((item) => {
        const q = search.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
      })
    : allItems;

  const headers = HEADERS[defType] ?? HEADERS['default'];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function renderRow(item: DefinitionListItem) {
    switch (defType) {
      case 'workflow':
        return <WorkflowRow item={item} />;
      case 'task':
        return <TaskRow item={item} />;
      case 'function':
        return <FunctionRow item={item} />;
      case 'mapping':
        return <MappingRow item={item} />;
      case 'extension':
        return <ExtensionRow item={item} />;
      case 'schema':
        return <SchemaRow item={item} />;
      case 'view':
        return <ViewRow item={item} />;
      default:
        return <DefaultRow item={item} />;
    }
  }

  const displayName = defType.charAt(0).toUpperCase() + defType.slice(1) + 's';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
          {!isLoading && totalCount > 0 && (
            <span className="text-sm text-muted-foreground">{totalCount} total</span>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Filter current page…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading {displayName.toLowerCase()}…
          </div>
        ) : !filtered.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {search ? `No ${defType}s match "${search}" on this page` : `No ${defType}s found`}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => navigate(`/definitions/${defType}/${item.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                >
                  {renderRow(item)}
                  <td className="px-4 py-3 text-right text-muted-foreground">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalCount > 0 && (
        <div className="rounded-lg border border-border bg-card px-2 shadow-sm">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}
