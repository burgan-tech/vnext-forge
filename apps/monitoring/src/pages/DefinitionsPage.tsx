import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';

import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { useDefinitionList, type DefinitionType } from '@monitoring/modules/definitions/api/definitions-queries';
import type { DefinitionListItem } from '@monitoring/shared/types/definitions-api';

const WORKFLOW_TYPE_LABELS: Record<string, string> = { F: 'Flow', S: 'State', P: 'Process' };
const WORKFLOW_TYPE_VARIANTS: Record<string, 'info' | 'warning' | 'secondary'> = {
  F: 'info',
  S: 'warning',
  P: 'secondary',
};

function WorkflowRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3">
        <Badge variant={WORKFLOW_TYPE_VARIANTS[item.type ?? 'F'] ?? 'secondary'} className="font-mono text-xs">
          {WORKFLOW_TYPE_LABELS[item.type ?? ''] ?? item.type ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
    </>
  );
}

function TaskRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3">
        <Badge variant={item.taskType === 'Http' ? 'info' : 'secondary'} className="font-mono text-xs">
          {item.taskType ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
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
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.returnType ?? '—'}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.parameterCount ?? 0} params</td>
    </>
  );
}

function MappingRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.usedBy?.join(', ') || '—'}</td>
    </>
  );
}

function DefaultRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
      <td className="px-4 py-3" />
    </>
  );
}

const HEADERS: Record<string, string[]> = {
  workflow: ['Name', 'Type', 'Version', 'Description'],
  task: ['Name', 'Task Type', 'Version', 'Status'],
  function: ['Name', 'Return Type', 'Version', 'Parameters'],
  mapping: ['Name', 'Version', 'Description', 'Used By'],
  default: ['Name', 'Version', 'Description', ''],
};

export function DefinitionsPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const defType = (type ?? 'workflow') as DefinitionType;
  const { data, isLoading } = useDefinitionList(defType);

  const filtered = (data ?? []).filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
  });

  const headers = HEADERS[defType] ?? HEADERS['default'];

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
      default:
        return <DefaultRow item={item} />;
    }
  }

  const displayName = defType.charAt(0).toUpperCase() + defType.slice(1) + 's';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
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
            {search ? `No ${defType}s match "${search}"` : `No ${defType}s found`}
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

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} {defType}
          {filtered.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ''}
        </p>
      )}
    </div>
  );
}
